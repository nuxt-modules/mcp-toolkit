import { defineMcpTool } from 'nitro-mcp-toolkit'

/**
 * Exercises the no-input overload and every field of `event.context.mcp`, so
 * the H3 event really is threaded through the SDK rather than lost in its
 * clone.
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
      // A separate, lower-level field: only the hand-wired `.fetch(request,
      // { authInfo })` escape hatch populates this. The declarative `auth`
      // option (see "Authentication" in the README, demoed on the admin
      // server) stashes what it resolves on `event.context` directly instead.
      auth: mcp.auth?.clientId ?? null,
      // `mcp.mcpReq` is the SDK's own per-request object, the escape hatch
      // for the multi-round-trip primitives (`inputRequired`/`acceptedContent`)
      // this field belongs to.
      requestState: mcp.mcpReq.requestState() ?? null,
      aborted: mcp.signal.aborted,
    }
  },
})
