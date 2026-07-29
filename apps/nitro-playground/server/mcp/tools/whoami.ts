import { defineMcpTool } from "nitro-mcp-toolkit";

/**
 * Exercises the no-input overload and every field of `McpContext`, so the H3
 * event really is threaded through the SDK rather than lost in its clone.
 */
export default defineMcpTool({
  name: "whoami",
  description: "Report what the server sees about the current request",
  handler: (ctx) => ({
    era: ctx.era,
    method: ctx.event.req.method,
    path: ctx.event.url.pathname,
    userAgent: ctx.event.req.headers.get("user-agent"),
    accept: ctx.event.req.headers.get("accept"),
    // Wave 3 fills this in; until then it proves the field is plumbed through.
    auth: ctx.auth?.clientId ?? null,
    // Wave 4 signs and reads this on every replayed round.
    requestState: ctx.mcp.mcpReq.requestState() ?? null,
    aborted: ctx.signal.aborted,
  }),
});
