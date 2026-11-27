---
"@nuxtjs/mcp-toolkit": patch
---

In development, adding or removing a tool, resource, prompt or handler file under `server/mcp/` now restarts Nuxt. Before, the generated server module kept the definitions found at startup, so a new file was not served until a manual restart and a deleted file broke every server route.
