---
"@nuxtjs/mcp-toolkit": patch
---

Fix MCP App handler bundling when `defineMcpApp` handlers use TypeScript syntax (e.g. `$fetch<T>()`) by transpiling extracted macro args before emitting Nitro virtual modules. Closes #279.
