---
"@nuxtjs/mcp-toolkit": minor
---

Allow tool handlers to return simplified values (`string`, `number`, `boolean`, object, array) that are automatically wrapped into `CallToolResult`. Thrown errors (including H3 errors via `createError()`) are caught and converted to `isError` results. Auto-generate fallback `content` for `isError` and `structuredContent` responses. Deprecate `textResult`, `jsonResult`, and `errorResult` helpers in favor of native returns.
