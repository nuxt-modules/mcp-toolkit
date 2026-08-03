import { defineMcpTool } from 'nitro-mcp-toolkit'

/**
 * Exercises the no-input overload and every field of `McpContext`, so the H3
 * event really is the one serving the request.
 */
export default defineMcpTool({
  description: 'Report what the server sees about the current request',
  handler: (ctx) => ({
    era: ctx.era,
    method: ctx.event.req.method,
    path: ctx.event.url.pathname,
    userAgent: ctx.event.req.headers.get('user-agent'),
    accept: ctx.event.req.headers.get('accept'),
    // Whatever a middleware resolved for this request, auth included, is on the
    // event rather than on a context of our own.
    client: ctx.mcp.clientInfo?.name ?? null,
    // Wave 4 signs and reads this on every replayed round.
    requestState: ctx.mcp.requestState ?? null,
    aborted: ctx.signal.aborted,
  }),
})
