---
"nitro-mcp-toolkit": minor
---

`mcp({ oauth })` protects a file-based endpoint without a route file. The module generates the `createMcpOAuth` call, wires it as the handler's `auth`, and mounts the RFC 9728 protected-resource document on the path RFC 9728 derives from `resource` — so a client that gets a `401` can find where to authenticate. `oauth` and `auth` cannot both be set on one endpoint, and a config without a JWKS URL throws at build rather than accepting everything.

```ts
// nitro.config.ts
export default defineConfig({
  modules: [
    mcp({
      oauth: {
        resource: 'https://api.example.com/mcp',
        authorizationServers: ['https://auth.example.com'],
        jwt: { jwks: 'https://auth.example.com/.well-known/jwks.json' },
      },
    }),
  ],
})
```
