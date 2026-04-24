import type { Ref } from 'vue'
import type { HostContext } from './host-bridge'
import { useMcpAppData } from './use-mcp-app-data'
import { useFollowUp } from './use-follow-up'
import { useToolCall } from './use-tool-call'
import { useExternalLink } from './use-external-link'

export type { HostContext } from './host-bridge'

export interface UseMcpAppReturn<T = unknown> {
  /** Hydrated from the inline data-script, then refreshed via `tool-result` and `callTool`. */
  data: Ref<T | null>
  /** Last error from the host, the transport, or a malformed payload. */
  error: Ref<Error | null>
  /** One-way latch: `true` until the first payload arrives, `false` forever after. */
  loading: Ref<boolean>
  /** `true` while a {@link callTool} request is in flight. */
  pending: Ref<boolean>
  /** Negotiated host context. `null` until the handshake completes. */
  hostContext: Ref<HostContext | null>
  /** Re-invoke an MCP tool on this server. */
  callTool: (name: string, params?: Record<string, unknown>) => Promise<T | null>
  /** Surface text to the LLM as if the user had typed it. */
  sendPrompt: (prompt: string) => void
  /** Ask the host to open a URL outside the iframe sandbox. */
  openLink: (url: string) => void
}

/**
 * Single composable wiring every MCP App capability for a SFC: reactive data
 * + host context, follow-up prompts, external links, and tool re-invocations.
 *
 * Auto-imported into `app/mcp/*.vue` SFCs — usually no explicit import needed.
 */
export function useMcpApp<T = unknown>(): UseMcpAppReturn<T> {
  const { data, loading, error, hostContext } = useMcpAppData<T>()
  const sendPrompt = useFollowUp()
  const openLink = useExternalLink()
  const tool = useToolCall<T>()

  const callTool = (name: string, params: Record<string, unknown> = {}): Promise<T | null> => {
    return tool.call(name, params).then((next) => {
      if (next !== null) data.value = next
      return next
    })
  }

  return {
    data,
    error,
    loading,
    pending: tool.pending,
    hostContext,
    callTool,
    sendPrompt,
    openLink,
  }
}
