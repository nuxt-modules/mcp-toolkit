---
"nitro-mcp-toolkit": minor
---

Connectors fill in the issuer conventions of three providers, so `oauth` is one call instead of a JWKS URL you looked up by hand. Each returns the same options object `mcp({ oauth })` and `createMcpOAuth` already accept, and each sits on its own subpath — an app that imports none of them never loads them.

```ts
import { clerk } from 'nitro-mcp-toolkit/oauth/clerk'

mcp({ oauth: clerk({ resource: 'https://api.example.com/mcp' }) })
```

`clerk` reads `CLERK_PUBLISHABLE_KEY` for the issuer and JWKS, skips audience checks (Clerk puts the OAuth client in `azp`, so use `authorizedParties`), and proxies RFC 8414 metadata from Clerk for clients that only look on the resource origin. `okta` covers custom authorization servers and derives JWKS from the issuer. `workos` covers AuthKit, where `aud` is the client id rather than the MCP URL.
