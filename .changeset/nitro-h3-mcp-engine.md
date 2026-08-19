---
"nitro-mcp-toolkit": minor
---

The runtime is now [h3-mcp](https://mcp.h3.dev) 0.2.0. `defineMcp*` still wrap plain returns and turn a throw into `isError`; transport, eras, auth, origin, MRTR, and subscriptions come from the engine.

This is a breaking change on 0.x:

- `ResourceTemplate` / `completable` are gone. A template is `uriTemplate` plus optional `list` / `complete`; prompt completions live on `arguments`.
- `inputRequired` / `mcpElicit` / `getElicitedContent` / `defineRequestState` replace `inputResponse` / `acceptedContent`.
- `legacy` / `responseMode` become `era` (`dual` is the default, `modern` is 2026-07-28 only).
- `event.context.mcp.mcpReq` / `auth` are gone. Read `inputResponses`, `requestState`, `signal`, and `era` off the engine context.
- `handler.fetch(req, { authInfo })` is gone; send `Authorization` or `x-api-key`.
- `handler.bus` / `handler.close` are gone. `handler.notify` still fans out to every listener.
- Cloudflare no longer needs `nodejs_compat`.
- An `X-MCP-Tools` header naming an unknown tool is a 400 only after origin and auth have passed, so the name does not leak to a caller who is not allowed through.
- `createMcpHandler` takes h3-mcp's `{ extensionPlugins }` as a second argument, for tasks and MCP Apps.
- Engine types (`AuthOptions`, `CacheHints`, `CallToolResult`, …) keep their h3-mcp names.
