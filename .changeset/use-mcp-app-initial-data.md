---
"@nuxtjs/mcp-toolkit": patch
---

Expose `initialData` from `useMcpApp()` as an immutable snapshot of the handler's initial `structuredContent`, separate from `data` which continues to refresh on `callTool` and host `tool-result` pushes. Closes #280.
