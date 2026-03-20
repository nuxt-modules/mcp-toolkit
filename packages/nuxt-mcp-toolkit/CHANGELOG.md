# @nuxtjs/mcp-toolkit

## 0.12.0

### Minor Changes

- [#169](https://github.com/nuxt-modules/mcp-toolkit/pull/169) [`4e686f9`](https://github.com/nuxt-modules/mcp-toolkit/commit/4e686f9cf16cf2a522bcc7043eadc9abffa54678) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Re-export `completable` from the MCP SDK and register it as a server auto-import for prompt argument autocompletion.

- [#170](https://github.com/nuxt-modules/mcp-toolkit/pull/170) [`516b157`](https://github.com/nuxt-modules/mcp-toolkit/commit/516b157d4e5542caad72b7d3809ff65680baa3ff) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `extractToolNames` utility to extract tool names from MCP JSON-RPC requests. Auto-imported in server context for use in middleware logging, monitoring, and access control.

- [#176](https://github.com/nuxt-modules/mcp-toolkit/pull/176) [`b82fcd2`](https://github.com/nuxt-modules/mcp-toolkit/commit/b82fcd20c485521af80bf714309ab86bcb998e27) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `group` and `tags` fields to `defineMcpTool()`, `defineMcpResource()`, and `defineMcpPrompt()` for organizing definitions by functional categories. Groups are auto-inferred from subdirectory structure (e.g. `server/mcp/tools/admin/delete-user.ts` → `group: 'admin'`), with explicit values taking precedence. For tools, `group` and `tags` are exposed to clients via `_meta` in `tools/list` responses. Recursive file loading is now supported for all definition types.

- [#173](https://github.com/nuxt-modules/mcp-toolkit/pull/173) [`3b6d25b`](https://github.com/nuxt-modules/mcp-toolkit/commit/3b6d25b584aca340165c3d01d821ef52c94c3aa7) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Export `McpToolExtra`, `McpPromptExtra`, and `McpResourceExtra` type aliases for typing the `extra` argument in MCP handlers without importing SDK internals. Add `autoImports` module option to disable all auto-imports and require explicit imports from `@nuxtjs/mcp-toolkit/server`.

- [#174](https://github.com/nuxt-modules/mcp-toolkit/pull/174) [`03dc79e`](https://github.com/nuxt-modules/mcp-toolkit/commit/03dc79e59c58af6330f761b93f8ad46847db6612) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add optional `role` field (`'user'` | `'assistant'`) to prompt definitions. When a handler returns a plain string, this role is used for the auto-wrapped message (defaults to `'user'`).

- [#172](https://github.com/nuxt-modules/mcp-toolkit/pull/172) [`67235c8`](https://github.com/nuxt-modules/mcp-toolkit/commit/67235c84fe5c2a0fd023beec6a3ebd1a76b18998) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Add `description`, `instructions`, and `icons` to module options and `defineMcpHandler()`. `description` and `icons` are sent as part of `serverInfo` during MCP initialization for client UIs. `instructions` provides operational guidance for AI agents, typically injected into the model's system prompt.

- [#167](https://github.com/nuxt-modules/mcp-toolkit/pull/167) [`f526a9b`](https://github.com/nuxt-modules/mcp-toolkit/commit/f526a9b1430723eb1ef6cfc749fcc5c881ee96e3) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Allow prompt handlers to return a simple `string`, automatically wrapped into `{ messages: [{ role: 'user', content: { type: 'text', text } }] }`. The full `GetPromptResult` return type is still supported.

- [#164](https://github.com/nuxt-modules/mcp-toolkit/pull/164) [`0a53d41`](https://github.com/nuxt-modules/mcp-toolkit/commit/0a53d414d24d43b01ccfcf4902b6a8fc87fee2c3) Thanks [@HugoRCD](https://github.com/HugoRCD)! - Allow tool handlers to return simplified values (`string`, `number`, `boolean`, object, array) that are automatically wrapped into `CallToolResult`. Thrown errors (including H3 errors via `createError()`) are caught and converted to `isError` results. Auto-generate fallback `content` for `isError` and `structuredContent` responses. Deprecate `textResult`, `jsonResult`, and `errorResult` helpers in favor of native returns.
