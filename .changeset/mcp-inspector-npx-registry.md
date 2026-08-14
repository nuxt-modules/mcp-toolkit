---
"@nuxtjs/mcp-toolkit": patch
---

The DevTools MCP Inspector launch always fetches `@modelcontextprotocol/inspector` from registry.npmjs.org, so a private npmrc can no longer 401 the download. Override with `MCP_INSPECTOR_REGISTRY` if you need a mirror.

The inspector now opens in a new browser tab instead of an iframe inside DevTools — the official UI is a full-page app and does not fit that panel. The MCP URL uses `localhost` so the inspector can reach Nuxt on either IPv4 or IPv6 loopback.
