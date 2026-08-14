---
"@nuxtjs/mcp-toolkit": minor
---

Clients can send an `X-MCP-Tools` header with a comma-separated list of tool names to limit what `tools/list` exposes. Names must match the catalog (including filename-generated kebab-case); unknown names return HTTP 400. No `server/mcp/index.ts` is required.
