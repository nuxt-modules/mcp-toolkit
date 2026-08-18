import type { H3Event } from 'h3'
import type { McpRequestContext } from 'h3-mcp'

/**
 * Push list-changed and resource-updated events to every client currently
 * listening on this endpoint.
 */
export interface McpNotifier {
  toolsChanged: () => void
  promptsChanged: () => void
  resourcesChanged: () => void
  resourceUpdated: (uri: string) => void
}

/**
 * The event a tool, resource or prompt handler is called with: a plain
 * `H3Event` whose `context.mcp` is guaranteed present, rather than the
 * optional field every other event on the app carries.
 */
export type McpEvent = H3Event & {
  context: H3Event['context'] & {
    mcp: McpRequestContext & { notify: McpNotifier }
  }
}

/**
 * Attach this endpoint's list-change notifier to `event.context.mcp` and
 * hand back the same event. h3-mcp has already populated the rest of the
 * context by the time a definition handler runs.
 *
 * @internal
 */
export function attachNotify(event: H3Event, notify: McpNotifier): McpEvent {
  const mcp = event.context.mcp
  if (!mcp) {
    throw new Error(
      '[nitro-mcp-toolkit] No MCP request in scope. Handlers must be reached through the handler returned by `createMcpHandler`.',
    )
  }

  Object.assign(mcp, { notify })
  return event as McpEvent
}
