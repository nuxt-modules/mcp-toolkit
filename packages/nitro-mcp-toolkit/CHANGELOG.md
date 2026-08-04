# nitro-mcp-toolkit

## 0.2.0

### Minor Changes

- [#311](https://github.com/nuxt-modules/mcp-toolkit/pull/311) [`d623f33`](https://github.com/nuxt-modules/mcp-toolkit/commit/d623f33f830bb7126811db6248ecce5ad1f3f9cf) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Tool, resource and prompt handlers now receive the request's `H3Event` directly instead of a separate context object, with everything MCP-specific attached at `event.context.mcp` — mirroring h3-mcp's event-first shape. This is a breaking change: `context.mcp.raw` moves to `context.mcp.mcpReq`, and anything reading the old context object needs to read off `event.context.mcp` instead.

  Also adds a declarative `auth` gate to `createMcpHandler` (bearer/API-key tokens, a custom `validate` callback, OAuth protected-resource metadata), and its JSON-serializable subset — a static token list — as an `auth` option on `mcp()`.

## 0.1.0

### Minor Changes

- [#310](https://github.com/nuxt-modules/mcp-toolkit/pull/310) [`8db8e10`](https://github.com/nuxt-modules/mcp-toolkit/commit/8db8e10eb7ca5b99df0e0a5ae2ea6c9a88dc26e1) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Moved off the alpha-only manual release track onto the same changesets flow as `@nuxtjs/mcp-toolkit`: versions and publishes from a PR, ships to the `latest` npm dist-tag. While the package stays pre-1.0, breaking changes are released as `minor` bumps rather than `major`.
