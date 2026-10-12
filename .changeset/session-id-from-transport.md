---
"@nuxtjs/mcp-toolkit": patch
---

The `MCP-Session-Id` header no longer reaches session storage unless the server assigned that session.

- `useMcpSession()` now uses the session the Node transport matched for the request, instead of reading the header. Before, with `mcp.sessions` off, a client could send any UUID and a tool calling `useMcpSession()` would read and write the store for that id. It now throws `No active MCP session`, as the docs already described. It also throws when called from `middleware`, which runs before the session is checked.
- On Cloudflare Workers the provider no longer reads or writes `mcp:sessions-meta:*`. The Workers transport is stateless and never assigns a session id, so the id it received was always client-chosen and was used unchecked in a storage key. `invalidateMcpSession()` has nothing to invalidate there; return 401/403 from middleware to reject a request.
