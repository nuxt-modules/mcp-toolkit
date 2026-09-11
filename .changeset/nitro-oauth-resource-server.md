---
"nitro-mcp-toolkit": minor
---

`createMcpOAuth` turns an MCP endpoint into an OAuth 2.1 resource server: JWT access tokens are verified against the issuer's JWKS, and the verified claims land on `event.context.oauth`. `iss` defaults to `authorizationServers` and `aud` to `resource`, so a token minted for another service is refused. It also hands you `metadataHandler` and `metadataPath` for the RFC 9728 protected-resource document, which is what a `401`'s `WWW-Authenticate` points clients at. `createMcpOAuth({ verify })` covers opaque tokens instead. This package does not issue tokens — pair it with an authorization server.

```ts
const oauth = createMcpOAuth({
  resource: 'https://api.example.com/mcp',
  authorizationServers: ['https://auth.example.com'],
  jwt: { jwks: 'https://auth.example.com/.well-known/jwks.json' },
})

export default createMcpHandler({ auth: oauth.auth, tools: [whoami] })
```
