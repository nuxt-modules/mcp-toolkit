---
"nitro-mcp-toolkit": minor
---

Clients can send an `X-MCP-Tools` header with a comma-separated list of tool names to limit what `tools/list` exposes. Unknown names return HTTP 400. `handler.definitions` stays the full catalog.
