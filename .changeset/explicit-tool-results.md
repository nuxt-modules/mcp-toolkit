---
"nitro-mcp-toolkit": minor
---

Add `toolResult()` for handlers that intentionally return a full MCP `CallToolResult` while also declaring an `outputSchema`. This keeps explicit protocol fields such as `isError` and `structuredContent` intact without reintroducing heuristics that could misclassify domain output with protocol-looking field names.
