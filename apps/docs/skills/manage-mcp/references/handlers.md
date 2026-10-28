# Handlers — 1.0

## Default and named servers

```ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    servers: {
      default: { dir: 'mcp' },
      admin: { dir: 'mcp-admin', auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] } },
    },
  },
})
```

This creates `/mcp` and `/mcp/admin`. Override a server's `route` for a different URL. `dir` is relative to each Nuxt layer's server directory.

The old `server/mcp/index.ts` and `server/mcp/handlers/*/index.ts` configuration conventions are removed. Move their configuration into `mcp.servers`, or compose an ordinary route.

## Manual routes

```ts [server/routes/private-mcp.ts]
import { createMcpHandler, createMcpOAuth } from '@nuxtjs/mcp-toolkit/server'
import account from '../mcp-private/tools/account'

const oauth = createMcpOAuth({
  resource: 'https://example.com/private-mcp',
  authorizationServers: ['https://auth.example.com'],
  verify: async (token, event) => verifyToken(token, event),
})

export default createMcpHandler({ name: 'private', auth: oauth.auth, tools: [account] })
```

The Nuxt helper adapts the portable Nuxt event to the shared engine. Export named definitions when composing them by hand. Mount the OAuth metadata handler separately when using manual wiring.

For a standalone Nitro 3 route, import `createMcpHandler` directly from `nitro-mcp-toolkit`.

## Endpoint ownership

```text
server/
  mcp/
    tools/search.ts
  mcp-admin/
    tools/purge.ts
```

Configure one server for each root. The public endpoint never discovers the admin tool, so no later filtering is needed.

Nuxt layers overlay files by their relative path. Earlier configured directories take priority, and the main app takes priority over its extended layers. Two different files advertising the same name still fail validation.

Built-in MCP Apps are deferred for the beta. Named endpoints contain ordinary tool, resource, and prompt definitions.
