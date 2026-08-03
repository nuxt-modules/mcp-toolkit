import type { H3Event } from 'h3'
import type { McpRequestContext } from 'h3-mcp'

/**
 * Context handed to every tool, resource and prompt handler.
 */
export interface McpContext {
  /**
   * The H3 event serving this request, giving handlers the whole Nitro
   * surface: `event.context` as populated by middleware, cookies, `waitUntil`.
   */
  event: H3Event
  /**
   * Aborts when the client cancels the request or the response stream closes.
   */
  signal: AbortSignal
  /**
   * The protocol revision serving this request: `modern` for 2026-07-28,
   * `legacy` for a 2025-era client.
   */
  era: 'legacy' | 'modern'
  /**
   * The request as the engine sees it, for everything the toolkit does not
   * wrap: `progress()`, `log()`, the multi-round-trip primitives
   * (`requestState`, `inputResponses`), and the client's own identity.
   */
  mcp: McpRequestContext
}

/**
 * Read the MCP request off the event.
 *
 * @internal
 */
export function buildContext(event: H3Event): McpContext {
  const mcp = event.context.mcp

  if (!mcp) {
    throw new Error(
      '[nitro-mcp-toolkit] No MCP request on this event. Handlers must be reached through the handler returned by `createMcpHandler`.',
    )
  }

  return {
    event,
    // A request without a stream carries no signal, so the connection's stands in.
    signal: mcp.signal ?? event.req.signal,
    era: mcp.era ?? 'modern',
    mcp,
  }
}
