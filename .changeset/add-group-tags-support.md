---
"@nuxtjs/mcp-toolkit": minor
---

Add `group` and `tags` fields to `defineMcpTool()`, `defineMcpResource()`, and `defineMcpPrompt()` for organizing definitions by functional categories. Groups are auto-inferred from subdirectory structure (e.g. `server/mcp/tools/admin/delete-user.ts` → `group: 'admin'`), with explicit values taking precedence. For tools, `group` and `tags` are exposed to clients via `_meta` in `tools/list` responses. Recursive file loading is now supported for all definition types.
