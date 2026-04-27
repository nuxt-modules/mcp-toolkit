import { ref, type Ref } from 'vue'
import { version } from '../../../package.json'

/**
 * Singleton transport between an MCP App iframe and its host. Three protocols
 * live behind one surface, picked at call-site:
 *   1. `window.openai.*` — ChatGPT-only extensions (preferred when present).
 *   2. JSON-RPC `ui/*` — MCP Apps spec (Cursor, Inspector, Goose, mcpjam, …).
 *   3. `{ type, payload }` — legacy mcp-ui envelope (older hosts).
 *
 * Composables (`useMcpAppData`, `useFollowUp`, `useToolCall`, `useExternalLink`)
 * share this instance so the `ui/initialize` handshake runs exactly once.
 *
 * @see https://modelcontextprotocol.io/extensions/apps
 * @see https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt
 * @see https://mcpui.dev/guide/embeddable-ui
 */

const DATA_SCRIPT_ID = '__mcp_app_data__'
const MCP_APPS_PROTOCOL_VERSION = '2026-01-26'
const HANDSHAKE_TIMEOUT_MS = 5_000
const APP_INFO = { name: 'nuxt-mcp-toolkit', version } as const

/** Subset of the spec's `HostContext` (theme, display, dims, locale). */
export interface HostContext {
  theme?: 'light' | 'dark'
  displayMode?: 'inline' | 'fullscreen' | 'pip'
  containerDimensions?: { width?: number, height?: number, maxWidth?: number, maxHeight?: number }
  locale?: string
  timeZone?: string
  platform?: 'web' | 'desktop' | 'mobile'
}

/** Subset of the ChatGPT Apps SDK global injected on iframe `window`. */
export interface OpenAiAppsGlobal {
  toolOutput?: unknown
  callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>
  openExternal?: (params: { href: string }) => void
  sendFollowUpMessage?: (params: { prompt: string, scrollToBottom?: boolean }) => void
}

declare global {
  interface Window {
    openai?: OpenAiAppsGlobal
  }
  interface WindowEventMap {
    'openai:set_globals': CustomEvent<{ globals?: { toolOutput?: unknown } }>
  }
}

export type LegacyMessageType = 'prompt' | 'link'

export interface HostBridge {
  /** Negotiated host context. `null` until the handshake completes. */
  hostContext: Ref<HostContext | null>
  /** Last error from the transport, the host, or a malformed payload. */
  error: Ref<Error | null>
  /** Initial payload from the inline data-script or `window.openai.toolOutput`. */
  initialData: unknown
  /** `window.openai`, if ChatGPT injected it. */
  openai: OpenAiAppsGlobal | undefined
  /**
   * Send a JSON-RPC request and wait for a matching response.
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
  /** Subscribe to host-pushed `ui/notifications/tool-result` (and `openai:set_globals`). */
  onToolResult: (cb: (data: unknown) => void) => () => void
  /** Resolves once the `ui/initialize` handshake completes (or fails). */
  whenReady: () => Promise<void>
}

interface JsonRpcMessage {
  jsonrpc: '2.0'
  id?: string | number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number, message: string }
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

/** Test-only: drop the cached bridge so the next call rebuilds it. */
export function __resetHostBridgeForTests(): void {
  cached = undefined
}

function createBridge(): HostBridge {
  const hostContext = ref<HostContext | null>(null)
  const error = ref<Error | null>(null)
  const setError = (err: unknown): void => {
    error.value = err instanceof Error ? err : new Error(String(err))
  }

  let initialData: unknown
  if (typeof document !== 'undefined') {
    const el = document.getElementById(DATA_SCRIPT_ID)
    if (el?.textContent) {
      try {
        initialData = JSON.parse(el.textContent)
      }
      catch (err) {
        setError(err)
      }
    }
  }
  const openai = typeof window !== 'undefined' ? window.openai : undefined
  if (openai?.toolOutput !== undefined) initialData = openai.toolOutput

  if (typeof window === 'undefined' || !window.parent || window.parent === window) {
    return makeNoopBridge({ hostContext, error, initialData, openai, setError })
  }

  let nextId = 1
  const pendingJsonRpc = new Map<string | number, PendingRequest>()
  const toolResultSubs = new Set<(data: unknown) => void>()

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
      if (data.error) entry.reject(new Error(data.error.message ?? 'JSON-RPC error'))
      else entry.resolve(data.result)
      return
    }
    if (data.method === 'ui/notifications/tool-result') {
      const next = data.params?.structuredContent
      if (next !== undefined) for (const sub of toolResultSubs) sub(next)
    }
  }

  const onOpenAiSetGlobals = (event: Event): void => {
    const next = (event as CustomEvent<{ globals?: { toolOutput?: unknown } }>).detail?.globals?.toolOutput
    if (next !== undefined) for (const sub of toolResultSubs) sub(next)
  }

  window.addEventListener('message', onMessage)
  window.addEventListener('openai:set_globals', onOpenAiSetGlobals as EventListener)

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
      const result = await request<{ hostContext?: HostContext } | null>('ui/initialize', {
        protocolVersion: MCP_APPS_PROTOCOL_VERSION,
        appInfo: APP_INFO,
        appCapabilities: { availableDisplayModes: ['inline', 'fullscreen', 'pip'] },
      })
      hostContext.value = result?.hostContext ?? null
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
    error,
    initialData,
    openai,
    request,
    notify,
    postLegacy,
    onToolResult: (cb) => {
      toolResultSubs.add(cb)
      return () => toolResultSubs.delete(cb)
    },
    whenReady: () => handshakePromise,
  }
}

function makeNoopBridge(state: {
  hostContext: Ref<HostContext | null>
  error: Ref<Error | null>
  initialData: unknown
  openai: OpenAiAppsGlobal | undefined
  setError: (err: unknown) => void
}): HostBridge {
  const noop = () => {
    state.setError(new Error('useMcpApp: no parent window — are you running inside an MCP host?'))
  }
  return {
    hostContext: state.hostContext,
    error: state.error,
    initialData: state.initialData,
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
