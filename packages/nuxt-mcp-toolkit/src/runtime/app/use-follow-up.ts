import { useHostBridge } from './host-bridge'

/**
 * Surface a follow-up message to the LLM as if the user had typed it.
 *
 * Cursor silently drops JSON-RPC notifications, so `ui/message` is sent as a
 * REQUEST. Internal building block behind {@link useMcpApp}; exported for tests.
 * @internal
 */
export function useFollowUp(): (prompt: string) => void {
  const bridge = useHostBridge()

  return (prompt: string): void => {
    if (typeof prompt !== 'string') {
      bridge.error.value = new TypeError('useFollowUp: prompt must be a string.')
      return
    }

    if (bridge.openai?.sendFollowUpMessage) {
      bridge.openai.sendFollowUpMessage({ prompt, scrollToBottom: true })
      return
    }

    bridge.request('ui/message', {
      role: 'user',
      content: [{ type: 'text', text: prompt }],
    }).catch((err) => {
      bridge.error.value = err instanceof Error ? err : new Error(String(err))
    })
    bridge.postLegacy('prompt', { prompt })
  }
}
