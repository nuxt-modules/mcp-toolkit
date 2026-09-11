import { defineMcpTool } from 'nitro-mcp-toolkit'

/**
 * Exercises the no-input overload and every field of `event.context.mcp`.
 */
export default defineMcpTool({
  description: 'Report what the server sees about the current request',
  handler: (event) => {
    const mcp = event.context.mcp
    return {
      era: mcp.era,
      method: event.req.method,
      path: event.url.pathname,
      userAgent: event.req.headers.get('user-agent'),
      accept: event.req.headers.get('accept'),
      protocolVersion: mcp.protocolVersion ?? null,
      requestState: mcp.requestState ?? null,
      aborted: mcp.signal?.aborted ?? false,
      oauth: event.context.oauth ?? null,
    }
  },
})
