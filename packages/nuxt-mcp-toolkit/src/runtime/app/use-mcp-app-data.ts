import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { useHostBridge, type HostCapabilities, type HostContext, type ToolResultMeta } from './host-bridge'

export interface UseMcpAppDataReturn<T> {
  /** First payload the host pushes — never updated after. */
  initialData: Ref<T | null>
  /** Latest payload, refreshed via host `tool-result` pushes. */
  data: Ref<T | null>
  /** `_meta` of the tool result that set `data`. */
  meta: Ref<ToolResultMeta | null>
  /** One-way latch: `true` until the first payload arrives or the tool call fails, `false` forever after. */
  loading: Ref<boolean>
  /** Last error from the host, the transport, or a malformed payload. */
  error: Ref<Error | null>
  /** Negotiated host context. `null` until the handshake completes, then kept current by `host-context-changed`. */
  hostContext: Ref<HostContext | null>
  /** Capabilities the host announced in the handshake. `null` until it completes. */
  hostCapabilities: Ref<HostCapabilities | null>
}

/**
 * Reactive bridge to the host's structured payload. Internal building block
 * behind {@link useMcpApp}; exported for tests only.
 * @internal
 */
export function useMcpAppData<T = unknown>(): UseMcpAppDataReturn<T> {
  const bridge = useHostBridge()

  const initialData = ref<T | null>(null) as Ref<T | null>
  const data = ref<T | null>(null) as Ref<T | null>
  const meta = ref<ToolResultMeta | null>(null)
  const loading = ref(true)

  const setData = (next: unknown, nextMeta?: ToolResultMeta): void => {
    if (next === null || next === undefined) return
    if (initialData.value === null) initialData.value = next as T
    data.value = next as T
    meta.value = nextMeta ?? null
    loading.value = false
  }

  if (bridge.initialData !== undefined) setData(bridge.initialData, bridge.initialMeta)

  const unsubscribe = bridge.onToolResult((outcome) => {
    if ('data' in outcome) setData(outcome.data, outcome.meta)
    else loading.value = false
  })
  if (getCurrentScope()) onScopeDispose(unsubscribe)

  return {
    initialData,
    data,
    meta,
    loading,
    error: bridge.error,
    hostContext: bridge.hostContext,
    hostCapabilities: bridge.hostCapabilities,
  }
}
