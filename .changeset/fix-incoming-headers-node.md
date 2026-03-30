---
"@nuxtjs/mcp-toolkit": patch
---

Read incoming MCP headers from `event.node.req` first so Nitro on Node (e.g. Vercel) does not call `Headers#get` on plain header objects, avoiding `get is not a function` at `/mcp`. Exports `getIncomingHeader` from `@nuxtjs/mcp-toolkit/server` for app middleware.
