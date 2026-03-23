---
"@nuxtjs/mcp-toolkit": patch
---

Improve h3 compatibility for MCP transports: `eventToWebRequest` uses `event.req` on h3 v2 and calls h3’s `toWebRequest` via namespace when available on v1 (no static `import { toWebRequest }` so h3 v2 installs don’t break); widen the `h3` peer range to `>=1.10.0`.
