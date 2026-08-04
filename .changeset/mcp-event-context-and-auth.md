---
"nitro-mcp-toolkit": minor
---

Tool, resource and prompt handlers now receive the request's `H3Event` directly instead of a separate context object, with everything MCP-specific attached at `event.context.mcp` — mirroring h3-mcp's event-first shape. This is a breaking change: `context.mcp.raw` moves to `context.mcp.mcpReq`, and anything reading the old context object needs to read off `event.context.mcp` instead.

Also adds a declarative `auth` gate to `createMcpHandler` (bearer/API-key tokens, a custom `validate` callback, OAuth protected-resource metadata), and its JSON-serializable subset — a static token list — as an `auth` option on `mcp()`.
