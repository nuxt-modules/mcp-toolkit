# nitro-mcp-toolkit

## 0.3.0

### Minor Changes

- [#323](https://github.com/nuxt-modules/mcp-toolkit/pull/323) [`936679e`](https://github.com/nuxt-modules/mcp-toolkit/commit/936679eb8cf70a139c2a04f805531f2ff40bc87e) Thanks [@HugoRCD](https://github.com/HugoRCD)! - The runtime is now [h3-mcp](https://mcp.h3.dev) 0.2.0. `defineMcp*` still wrap plain returns and turn a throw into `isError`; transport, eras, auth, origin, MRTR, and subscriptions come from the engine.

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
  - Engine types (`AuthOptions`, `CacheHints`, `CallToolResult`, `Era`, `PluginOptions`, …) keep their h3-mcp names.
  - `getInputResponses` / `getMissingInputs` / `canRequestInput` / `getSupportedInputs` / `McpJsonRpcError` are re-exported so a handler does not need a second import from `h3-mcp`.
  - `nitro` is an optional peer: it is only required for `nitro-mcp-toolkit/module`. `createMcpHandler` needs `h3`.
  - `createMcpTestClient` accepts `{ headers }` so a Bearer token or `X-MCP-Tools` allowlist does not need a custom `fetch` wrap.
  - Import a mounted handler as `{ mcp }` (or `{ adminMcp }` for `/admin/mcp`) from `nitro-mcp-toolkit/servers`. `#mcp/<slug>/handler` is still what Nitro mounts, not what an app imports.

## 0.2.0

### Minor Changes

- [#311](https://github.com/nuxt-modules/mcp-toolkit/pull/311) [`d623f33`](https://github.com/nuxt-modules/mcp-toolkit/commit/d623f33f830bb7126811db6248ecce5ad1f3f9cf) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Tool, resource and prompt handlers now receive the request's `H3Event` directly instead of a separate context object, with everything MCP-specific attached at `event.context.mcp` — mirroring h3-mcp's event-first shape. This is a breaking change: `context.mcp.raw` moves to `context.mcp.mcpReq`, and anything reading the old context object needs to read off `event.context.mcp` instead.

  Also adds a declarative `auth` gate to `createMcpHandler` (bearer/API-key tokens, a custom `validate` callback, OAuth protected-resource metadata), and its JSON-serializable subset — a static token list — as an `auth` option on `mcp()`.

- [#320](https://github.com/nuxt-modules/mcp-toolkit/pull/320) [`108baa7`](https://github.com/nuxt-modules/mcp-toolkit/commit/108baa7fbfa193302c8db9e6ef052f5e1c5b00cf) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Clients can send an `X-MCP-Tools` header with a comma-separated list of tool names to limit what `tools/list` exposes. Unknown names return HTTP 400. `handler.definitions` stays the full catalog.

## 0.1.0

### Minor Changes

- [#310](https://github.com/nuxt-modules/mcp-toolkit/pull/310) [`8db8e10`](https://github.com/nuxt-modules/mcp-toolkit/commit/8db8e10eb7ca5b99df0e0a5ae2ea6c9a88dc26e1) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Moved off the alpha-only manual release track onto the same changesets flow as `@nuxtjs/mcp-toolkit`: versions and publishes from a PR, ships to the `latest` npm dist-tag. While the package stays pre-1.0, breaking changes are released as `minor` bumps rather than `major`.
