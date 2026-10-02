import { ref, type Ref } from 'vue'
import { errorText, toToolResultMeta, useHostBridge, type ToolResultMeta, type ToolResultParams } from './host-bridge'

const SAFE_TOOL_NAME = /^[A-Z][\w.-]{0,127}$/i
const TOOL_CALL_TIMEOUT_MS = 30_000

export interface UseToolCallReturn<T> {
  /** Invoke the tool. With a preset `name`, pass only params; otherwise `(name, params)`. */
  call: (...args: ToolCallArgs) => Promise<T | null>
  /** `true` while a `call` is in flight. */
  pending: Ref<boolean>
  /** Last error from the call (transport, validation, host-reported, or a tool result with `isError`). */
  error: Ref<Error | null>
  /** Last successful payload returned by `call`. */
  result: Ref<T | null>
  /** `_meta` of the tool result behind `result`. */
  meta: Ref<ToolResultMeta | null>
}

type ToolCallArgs = [params?: Record<string, unknown>] | [name: string, params?: Record<string, unknown>]

/**
 * Call an MCP tool on the same server without writing the app's `data`. Routes
 * through `window.openai.callTool` on ChatGPT, otherwise JSON-RPC `tools/call`
 * over `postMessage` once the `ui/initialize` handshake has settled.
 */
export function useToolCall<T = unknown>(toolName?: string): UseToolCallReturn<T> {
  const bridge = useHostBridge()

  const pending = ref(false)
  const error = ref<Error | null>(null)
  const result = ref<T | null>(null) as Ref<T | null>
  const meta = ref<ToolResultMeta | null>(null)

  const invoke = async (name: string, params: Record<string, unknown>): Promise<T | null> => {
    if (typeof name !== 'string' || !SAFE_TOOL_NAME.test(name)) {
      error.value = new TypeError(`useToolCall: invalid tool name ${JSON.stringify(name)}.`)
      return null
    }

    pending.value = true
    error.value = null

    try {
      // Hosts may drop a `tools/call` that races the handshake.
      if (!bridge.openai?.callTool) await bridge.whenReady()
      const raw = bridge.openai?.callTool
        ? await bridge.openai.callTool(name, params)
        : await bridge.request('tools/call', { name, arguments: params }, TOOL_CALL_TIMEOUT_MS)
      if ((raw as ToolResultParams | null)?.isError) {
        throw new Error(errorText((raw as ToolResultParams).content) ?? `useToolCall: the "${name}" tool call failed.`)
      }
      const next = pickStructured<T>(raw)
      if (next !== null) {
        result.value = next
        meta.value = pickMeta(raw)
      }
      return next
    }
    catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      return null
    }
    finally {
      pending.value = false
    }
  }

  const call = ((...args: ToolCallArgs) => {
    if (toolName) {
      const params = (args[0] ?? {}) as Record<string, unknown>
      return invoke(toolName, params)
    }
    const [name, params] = args as [string, Record<string, unknown>?]
    return invoke(name, params ?? {})
  }) as UseToolCallReturn<T>['call']

  return { call, pending, error, result, meta }
}

function pickStructured<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  return ((r.structuredContent ?? r.output) as T | undefined) ?? null
}

function pickMeta(raw: unknown): ToolResultMeta | null {
  if (!raw || typeof raw !== 'object') return null
  return toToolResultMeta((raw as Record<string, unknown>)._meta) ?? null
}
