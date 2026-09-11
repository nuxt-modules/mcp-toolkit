---
"@nuxtjs/mcp-toolkit": patch
---

The DevTools MCP Inspector launcher now forwards configured HTTP headers such as `Authorization` when it starts the official inspector process. This keeps authenticated endpoints working from Nuxt DevTools without needing to re-enter the headers in the Inspector UI.
