---
"@nuxtjs/mcp-toolkit": patch
---

Default `swr` to `false` for cached tools and resources. Nitro's underlying default (`swr: true`) returned stale entries immediately and refreshed the handler in a background task that ran after the MCP request had been answered, silently dropping any request-scoped writes (e.g. `useLogger(event).set()`). Pass `cache: { maxAge: '1h', swr: true }` to opt back in.
