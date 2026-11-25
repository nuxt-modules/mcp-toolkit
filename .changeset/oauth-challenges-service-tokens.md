---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

OAuth endpoints send the challenges the MCP authorization specification describes. The `401` challenge names `scopesSupported` in its `scope` parameter, and a call refused for a missing scope on the modern revision returns HTTP `403` with `WWW-Authenticate: Bearer error="insufficient_scope"`, the scopes needed and `resource_metadata`, so clients can request more access.

`createMcpOAuth` accepts `serviceTokens`: static bearer tokens for callers that cannot sign in, such as agents or scheduled jobs. Each token is read at request time and sets fixed claims, so `scopes` and `authorize` apply to it.
