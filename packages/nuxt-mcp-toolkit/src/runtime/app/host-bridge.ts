import { ref, type Ref } from 'vue'
import { version } from '../../../package.json'

/**
 * Singleton transport between an MCP App iframe and its host. Three protocols
 * live behind one surface, picked at call-site:
 *   1. `window.openai.*` — ChatGPT-only extensions (preferred when present).
 *   2. JSON-RPC `ui/*` — MCP Apps spec (Cursor, Inspector, Goose, mcpjam, …).
 *   3. `{ type, payload }` — legacy mcp-ui envelope (older hosts).
 *
 * Composables (`useMcpAppData`, `useFollowUp`, `useToolCall`, `useExternalLink`,
 * `useHostRequests`) share this instance so the `ui/initialize` handshake runs
 * exactly once.
 *
 * @see https://modelcontextprotocol.io/extensions/apps
 * @see https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt
 * @see https://mcpui.dev/guide/embeddable-ui
 */

const MCP_APPS_PROTOCOL_VERSION = '2026-01-26'
const HANDSHAKE_TIMEOUT_MS = 5_000
const APP_INFO = { name: 'nuxt-mcp-toolkit', version } as const

export type DisplayMode = 'inline' | 'fullscreen' | 'pip'

/** Subset of the spec's `HostContext` (theme, display, dims, locale). */
export interface HostContext {
  theme?: 'light' | 'dark'
  displayMode?: DisplayMode
  availableDisplayModes?: DisplayMode[]
  containerDimensions?: { width?: number, height?: number, maxWidth?: number, maxHeight?: number }
  locale?: string
  timeZone?: string
  platform?: 'web' | 'desktop' | 'mobile'
}

/** Subset of the spec's `HostCapabilities`; a key is present when the host supports it. */
export interface HostCapabilities {
  openLinks?: object
  downloadFile?: object
  serverTools?: { listChanged?: boolean }
  serverResources?: { listChanged?: boolean }
  logging?: object
  updateModelContext?: object
  message?: object
}

/** Subset of the ChatGPT Apps SDK global injected on iframe `window`. */
export interface OpenAiAppsGlobal {
  toolOutput?: unknown
  toolResponseMetadata?: Record<string, unknown> | null
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>
  openExternal?: (params: { href: string }) => void
  sendFollowUpMessage?: (params: { prompt: string, scrollToBottom?: boolean }) => void
  requestDisplayMode?: (params: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>
}

declare global {
  interface Window {
    openai?: OpenAiAppsGlobal
  }
  interface WindowEventMap {
    'openai:set_globals': CustomEvent<{ globals?: Pick<OpenAiAppsGlobal, 'toolOutput' | 'toolResponseMetadata'> }>
  }
}

export type LegacyMessageType = 'prompt' | 'link'

/** Rejection of a host request — the host's JSON-RPC `code` and `data`, or `cancelled` for a declined download. */
export interface McpAppRequestError extends Error {
  code?: number
  data?: unknown
  cancelled?: boolean
}

export function createRequestError(message: string, fields: Pick<McpAppRequestError, 'code' | 'data' | 'cancelled'> = {}): McpAppRequestError {
  return Object.assign(new Error(message), fields)
}

/** `_meta` of a tool result — data for the view that hosts keep out of the model's context. */
export type ToolResultMeta = Record<string, unknown>

export function toToolResultMeta(value: unknown): ToolResultMeta | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ToolResultMeta : undefined
}

/** ChatGPT documents `toolResponseMetadata` as the MCP result envelope, but has also passed the bare `_meta`. */
function openAiResultMeta(metadata: unknown): ToolResultMeta | undefined {
  const mcpToolResult = toToolResultMeta(toToolResultMeta(metadata)?.mcp_tool_result)
  return mcpToolResult ? toToolResultMeta(mcpToolResult._meta) : toToolResultMeta(metadata)
}

/** What the host pushed for the tool call that opened the view. */
export type ToolOutcome = { data: unknown, meta?: ToolResultMeta } | { error: Error }

export interface HostBridge {
  /** Negotiated host context. `null` until the handshake completes, then kept current by `host-context-changed`. */
  hostContext: Ref<HostContext | null>
  /** Capabilities the host announced in the handshake. `null` until it completes. */
  hostCapabilities: Ref<HostCapabilities | null>
  /** Whether the `ui/initialize` handshake succeeded. */
  initialized: Ref<boolean>
  /** Last error from the transport, the host, or a malformed payload. */
  error: Ref<Error | null>
  /** Initial payload from `window.openai.toolOutput`. */
  initialData: unknown
  /** Initial `_meta` from `window.openai.toolResponseMetadata`. */
  initialMeta: ToolResultMeta | undefined
  /** `window.openai`, if ChatGPT injected it. */
  openai: OpenAiAppsGlobal | undefined
  /**
   * Send a JSON-RPC request and wait for a matching response. A JSON-RPC error
   * rejects with an `Error` carrying the error's `code` and `data`.
   * @internal
   */
  request: <R = unknown>(method: string, params?: Record<string, unknown>, timeoutMs?: number) => Promise<R>
  /**
   * Send a JSON-RPC notification (no response expected).
   * @internal
   */
  notify: (method: string, params?: Record<string, unknown>) => void
  /**
   * Send a legacy mcp-ui envelope `{ type, payload }`.
   * @internal
   */
  postLegacy: (type: LegacyMessageType, payload: Record<string, unknown>) => void
  /** Subscribe to host-pushed `tool-result` / `tool-cancelled` (and `openai:set_globals`). */
  onToolResult: (cb: (outcome: ToolOutcome) => void) => () => void
  /** Resolves once the `ui/initialize` handshake completes (or fails). */
  whenReady: () => Promise<void>
}

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number, message: string, data?: unknown }
}

export interface ToolResultParams {
  isError?: boolean
  content?: Array<{ type: string, text?: unknown }>
  structuredContent?: unknown
  _meta?: unknown
}

export function errorText(content: ToolResultParams['content']): string | undefined {
  const text = content?.flatMap(block => block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n')
  return text || undefined
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let cached: HostBridge | undefined

/** Lazy per-iframe bridge — same instance for the page lifetime. */
export function useHostBridge(): HostBridge {
  if (cached) return cached
  cached = createBridge()
  return cached
}

export function hasHostWindow(): boolean {
  return typeof window !== 'undefined' && !!window.parent && window.parent !== window
}

/** Test-only: drop the cached bridge so the next call rebuilds it. */
export function __resetHostBridgeForTests(): void {
  cached = undefined
}

function createBridge(): HostBridge {
  const hostContext = ref<HostContext | null>(null)
  const hostCapabilities = ref<HostCapabilities | null>(null)
  const initialized = ref(false)
  const error = ref<Error | null>(null)
  const setError = (err: unknown): void => {
    error.value = err instanceof Error ? err : new Error(String(err))
  }

  const openai = typeof window !== 'undefined' ? window.openai : undefined
  const initialData = openai?.toolOutput
  const initialMeta = openAiResultMeta(openai?.toolResponseMetadata)

  if (!hasHostWindow()) {
    return makeNoopBridge({ hostContext, hostCapabilities, initialized, error, initialData, initialMeta, openai, setError })
  }

  let nextId = 1
  const pendingJsonRpc = new Map<string | number, PendingRequest>()
  const toolResultSubs = new Set<(outcome: ToolOutcome) => void>()
  // Replayed to late subscribers — hosts push each result only once.
  let latestToolResult: ToolOutcome | undefined
  const publish = (outcome: ToolOutcome): void => {
    latestToolResult = outcome
    for (const sub of toolResultSubs) sub(outcome)
  }
  const publishToolResult = (next: unknown, meta?: ToolResultMeta): void => {
    if (next !== undefined) publish({ data: next, meta })
  }
  const publishToolFailure = (message: string): void => {
    const err = new Error(message)
    setError(err)
    publish({ error: err })
  }

  const post = (msg: unknown): void => {
    try {
      window.parent.postMessage(msg, '*')
    }
    catch (err) {
      setError(err)
    }
  }

  const request = <R = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = HANDSHAKE_TIMEOUT_MS): Promise<R> => {
    const id = `mcp-app-${nextId++}`
    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingJsonRpc.delete(id)
        reject(new Error(`useMcpApp: host did not respond to "${method}" within ${timeoutMs}ms.`))
      }, timeoutMs)
      pendingJsonRpc.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      post({ jsonrpc: '2.0', id, method, params })
    })
  }

  const notify = (method: string, params: Record<string, unknown> = {}): void => {
    post({ jsonrpc: '2.0', method, params })
  }

  const postLegacy = (type: LegacyMessageType, payload: Record<string, unknown>): void => {
    post({ type, payload })
  }

  const onMessage = (event: MessageEvent<unknown>): void => {
    if (event.source !== window.parent) return
    const data = event.data as JsonRpcMessage | null
    if (!data || typeof data !== 'object' || data.jsonrpc !== '2.0') return

    if (data.method === undefined && data.id !== undefined) {
      const entry = pendingJsonRpc.get(data.id)
      if (!entry) return
      clearTimeout(entry.timer)
      pendingJsonRpc.delete(data.id)
      if (data.error) {
        const { code, message, data: errorData } = data.error
        entry.reject(createRequestError(message ?? 'JSON-RPC error', { code, data: errorData }))
      }
      else entry.resolve(data.result)
      return
    }
    if (data.method === 'ui/notifications/tool-result') {
      const params = data.params as ToolResultParams | undefined
      if (params?.isError) publishToolFailure(errorText(params.content) ?? 'useMcpApp: the tool call failed.')
      else publishToolResult(params?.structuredContent, toToolResultMeta(params?._meta))
      return
    }
    if (data.method === 'ui/notifications/tool-cancelled') {
      const reason = data.params?.reason
      publishToolFailure(typeof reason === 'string' && reason ? `useMcpApp: the tool call was cancelled: ${reason}` : 'useMcpApp: the tool call was cancelled.')
      return
    }
    if (data.method === 'ui/notifications/host-context-changed') {
      // Skip no-op updates — Claude repeats unchanged `safeAreaInsets` throughout a fullscreen animation.
      const changes = (data.params ?? {}) as Partial<HostContext>
      const current = hostContext.value ?? {}
      const isUnchanged = Object.entries(changes)
        .every(([key, value]) => JSON.stringify(current[key as keyof HostContext]) === JSON.stringify(value))
      if (!isUnchanged) hostContext.value = { ...current, ...changes }
    }
  }

  // The event carries only the globals that changed, so the other one is read from `window.openai`.
  const onOpenAiSetGlobals = (event: WindowEventMap['openai:set_globals']): void => {
    const globals = event.detail?.globals
    if (globals?.toolOutput === undefined && globals?.toolResponseMetadata === undefined) return
    publishToolResult(
      globals.toolOutput ?? window.openai?.toolOutput,
      openAiResultMeta(globals.toolResponseMetadata ?? window.openai?.toolResponseMetadata),
    )
  }

  window.addEventListener('message', onMessage)
  window.addEventListener('openai:set_globals', onOpenAiSetGlobals)

  // Cursor-class hosts only subscribe to iframe messages once they receive this
  // legacy ready signal. https://mcpui.dev/guide/embeddable-ui#ui-lifecycle-iframe-ready
  post({ type: 'ui-lifecycle-iframe-ready' })

  const handshakePromise = (async () => {
    await Promise.resolve()
    if (typeof document !== 'undefined' && document.readyState === 'loading') {
      await new Promise<void>((resolve) => {
        document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
      })
    }

    installAutoResize(notify, post)

    try {
      const result = await request<{ hostContext?: HostContext, hostCapabilities?: HostCapabilities } | null>('ui/initialize', {
        protocolVersion: MCP_APPS_PROTOCOL_VERSION,
        appInfo: APP_INFO,
        appCapabilities: { availableDisplayModes: ['inline', 'fullscreen', 'pip'] },
      })
      hostContext.value = result?.hostContext ?? null
      hostCapabilities.value = result?.hostCapabilities ?? null
      initialized.value = true
    }
    catch (err) {
      // Spec hosts that don't implement `ui/initialize` (Inspector, older Cursor)
      // just don't reply; we still emit `initialized` to unlock guest → host msgs.
      setError(err)
    }

    notify('ui/notifications/initialized')
  })()

  return {
    hostContext,
    hostCapabilities,
    initialized,
    error,
    initialData,
    initialMeta,
    openai,
    request,
    notify,
    postLegacy,
    onToolResult: (cb) => {
      toolResultSubs.add(cb)
      if (latestToolResult !== undefined) cb(latestToolResult)
      return () => toolResultSubs.delete(cb)
    },
    whenReady: () => handshakePromise,
  }
}

function makeNoopBridge(state: {
  hostContext: Ref<HostContext | null>
  hostCapabilities: Ref<HostCapabilities | null>
  initialized: Ref<boolean>
  error: Ref<Error | null>
  initialData: unknown
  initialMeta: ToolResultMeta | undefined
  openai: OpenAiAppsGlobal | undefined
  setError: (err: unknown) => void
}): HostBridge {
  const noop = () => {
    state.setError(new Error('useMcpApp: no parent window — are you running inside an MCP host?'))
  }
  return {
    hostContext: state.hostContext,
    hostCapabilities: state.hostCapabilities,
    initialized: state.initialized,
    error: state.error,
    initialData: state.initialData,
    initialMeta: state.initialMeta,
    openai: state.openai,
    request: () => {
      noop()
      return Promise.reject(state.error.value!)
    },
    notify: noop,
    postLegacy: noop,
    onToolResult: () => () => {},
    whenReady: () => Promise.resolve(),
  }
}

/**
 * Emit `ui/notifications/size-changed` (spec) and `ui-size-change` (legacy) on
 * iframe content resize. Synced to rAF, deduped on exact size to avoid the
 * report → host-resize → ResizeObserver feedback loop.
 */
function installAutoResize(
  notify: (method: string, params: Record<string, unknown>) => void,
  post: (msg: unknown) => void,
): void {
  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return

  let lastW = 0
  let lastH = 0
  let frame: number | undefined

  const send = () => {
    frame = undefined
    const root = document.documentElement
    const body = document.body
    const w = Math.ceil(Math.max(root?.scrollWidth ?? 0, body?.scrollWidth ?? 0))
    const h = Math.ceil(body?.scrollHeight ?? root?.scrollHeight ?? 0)
    // 0 height collapses the iframe → vh-based rules resolve to 0 → infinite loop.
    if (h <= 0) return
    if (w === lastW && h === lastH) return
    lastW = w
    lastH = h
    notify('ui/notifications/size-changed', { width: w, height: h })
    post({ type: 'ui-size-change', payload: { width: w, height: h } })
  }

  const schedule = () => {
    if (frame !== undefined) return
    frame = requestAnimationFrame(send)
  }

  const observer = new ResizeObserver(schedule)
  if (document.documentElement) observer.observe(document.documentElement)
  if (document.body) observer.observe(document.body)
  window.addEventListener('resize', schedule, { passive: true })

  send()
}
