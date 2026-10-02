import type { Ref } from 'vue'
import type { HostCapabilities, HostContext, ToolResultMeta } from './host-bridge'
import { useMcpAppData } from './use-mcp-app-data'
import { useFollowUp } from './use-follow-up'
import { useToolCall } from './use-tool-call'
import { useExternalLink } from './use-external-link'
import { useHostRequests, type UseHostRequestsReturn } from './use-host-requests'

export type { DisplayMode, HostCapabilities, HostContext, McpAppRequestError, ToolResultMeta } from './host-bridge'
export type { DownloadFileContent } from './use-host-requests'
export type { UseToolCallReturn } from './use-tool-call'
export { useToolCall } from './use-tool-call'

export interface UseMcpAppReturn<T = unknown> extends UseHostRequestsReturn {
  /** First `structuredContent` the host pushes — never updated after. */
  initialData: Ref<T | null>
  /** Latest `structuredContent`, refreshed via `tool-result` and `callTool`. */
  data: Ref<T | null>
  /** `_meta` of the tool result that set `data`. */
  meta: Ref<ToolResultMeta | null>
  /** Last error from the host, the transport, a malformed payload, or a failed {@link callTool}. */
  error: Ref<Error | null>
  /** One-way latch: `true` until the first payload arrives or the tool call fails, `false` forever after. */
  loading: Ref<boolean>
  /** `true` while a {@link callTool} request is in flight. */
  pending: Ref<boolean>
  /** Negotiated host context. `null` until the handshake completes, then kept current by `host-context-changed`. */
  hostContext: Ref<HostContext | null>
  /** Capabilities the host announced in the handshake. `null` until it completes. */
  hostCapabilities: Ref<HostCapabilities | null>
  /** Re-invoke an MCP tool on this server. */
  callTool: (name: string, params?: Record<string, unknown>) => Promise<T | null>
  /** Surface text to the LLM as if the user had typed it. */
  sendPrompt: (prompt: string) => void
  /** Ask the host to open a URL outside the iframe sandbox. */
  openLink: (url: string) => void
}

/**
 * Single composable wiring every MCP App capability for a SFC: reactive data
 * + host context, follow-up prompts, external links, tool re-invocations,
 * display mode, model context, and file downloads.
 *
 * Auto-imported into `app/mcp/*.vue` SFCs — usually no explicit import needed.
 */
export function useMcpApp<T = unknown>(): UseMcpAppReturn<T> {
  const { initialData, data, meta, loading, error, hostContext, hostCapabilities } = useMcpAppData<T>()
  const sendPrompt = useFollowUp()
  const openLink = useExternalLink()
  const tool = useToolCall<T>()
  const { requestDisplayMode, updateModelContext, downloadFile } = useHostRequests()

  const callTool = (name: string, params: Record<string, unknown> = {}): Promise<T | null> => {
    return tool.call(name, params).then((next) => {
      if (next !== null) {
        data.value = next
        meta.value = tool.meta.value
        loading.value = false
      }
      else if (tool.error.value) {
        error.value = tool.error.value
        loading.value = false
      }
      return next
    })
  }

  return {
    initialData,
    data,
    meta,
    error,
    loading,
    pending: tool.pending,
    hostContext,
    hostCapabilities,
    callTool,
    sendPrompt,
    openLink,
    requestDisplayMode,
    updateModelContext,
    downloadFile,
  }
}
