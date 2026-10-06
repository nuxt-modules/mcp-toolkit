---
"@nuxtjs/mcp-toolkit": patch
---

OAuth discovery probes that append the well-known suffix to the MCP endpoint, such as `/mcp/.well-known/oauth-protected-resource` or `/mcp/admin/.well-known/oauth-authorization-server`, now get the same JSON 404 as the root `/.well-known/*` probes. Before, they fell through to the Nuxt page renderer: clients got an HTML page back, and with evlog enabled the page 404 was logged as an error under the MCP service. It is now an `info` event with status 404.
