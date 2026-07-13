import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { useHostBridge, type HostContext } from './host-bridge'

export interface UseMcpAppDataReturn<T> {
  /** Snapshot of the inline data-script (or `window.openai.toolOutput`) at mount — never updated. */
  initialData: Ref<T | null>
  /** Hydrated from the inline data-script, then refreshed via host `tool-result` pushes. */
  data: Ref<T | null>
  /** One-way latch: `true` until the first payload arrives, `false` forever after. */
  loading: Ref<boolean>
  /** Last error from the host, the transport, or a malformed payload. */
  error: Ref<Error | null>
  /** Negotiated host context. `null` until the handshake completes. */
  hostContext: Ref<HostContext | null>
}

/**
 * Reactive bridge to the host's structured payload. Internal building block
 * behind {@link useMcpApp}; exported for tests only.
 * @internal
 */
export function useMcpAppData<T = unknown>(): UseMcpAppDataReturn<T> {
  const bridge = useHostBridge()

  const initialData = ref<T | null>(
    bridge.initialData !== undefined ? (bridge.initialData as T) : null,
  ) as Ref<T | null>
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(true)

  const setData = (next: unknown): void => {
    if (next === null || next === undefined) return
    data.value = next as T
    loading.value = false
  }

  if (bridge.initialData !== undefined) setData(bridge.initialData)

  const unsubscribe = bridge.onToolResult(setData)
  if (getCurrentScope()) onScopeDispose(unsubscribe)

  return {
    initialData,
    data,
    loading,
    error: bridge.error,
    hostContext: bridge.hostContext,
  }
}
