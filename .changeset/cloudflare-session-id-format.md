---
"@nuxtjs/mcp-toolkit": patch
---

On Cloudflare Workers, a request whose `MCP-Session-Id` header is not a UUID v4 now gets a 400 `Invalid session ID format`, as it already does on the Node server. Before, the raw header value was used to build the `mcp:sessions-meta:*` storage key, so a client could make the server read, and after `invalidateMcpSession()` write, arbitrary keys under that prefix.
