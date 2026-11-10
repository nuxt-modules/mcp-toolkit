---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

Configure OAuth and request-time access policies in `server/mcp/index.ts`. Provider adapters prepare authentication and the module serves protected-resource discovery automatically.

Add a Better Auth JWT access-token adapter and a Clerk backend-client integration for JWT and opaque OAuth tokens. Nuxt exposes the provider adapters through `@nuxtjs/mcp-toolkit/oauth/*`. Proof-bound tokens are rejected by the bearer-only verifier.
