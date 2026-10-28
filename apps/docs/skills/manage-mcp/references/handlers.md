# Endpoints — 1.0

## Use the default server

Without a `servers` option, the module creates one server from its top-level options. It scans `server/mcp` and mounts `/mcp` unless you override `dir` or `route`.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: { name: 'Example MCP', websiteUrl: 'https://example.com/docs/mcp' },
})
```

## Add named servers

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    servers: {
      default: { dir: 'mcp' },
      admin: {
        dir: 'mcp-admin',
        auth: { tokens: [process.env.MCP_ADMIN_TOKEN!] },
      },
    },
  },
})
```

The key `default` uses the top-level route and defaults to the directory `mcp`. Other keys default to `<route>/<key>` and `mcp-<key>`. Set `route` and `dir` explicitly when another layout is clearer.

When `servers` is present, only the configured entries exist. A configuration containing only `admin` does not also create a public `/mcp` server.

## Override inherited options

Each entry inherits the top-level server options. Keep shared identity fields at the top level and put authentication on the intended endpoint. Do not set top-level `auth` and then override a named endpoint with `oauth`: that endpoint would inherit both, which is rejected. Configure those mechanisms per server when they differ.

A server scans each configured root through all Nuxt layers. The app's file wins over the same relative file in an extended layer. See [directory ownership](https://mcp-toolkit.nuxt.dev/handlers/organization).

The old `server/mcp/index.ts` and `server/mcp/handlers/*/index.ts` endpoint conventions are removed. See [migration](https://mcp-toolkit.nuxt.dev/getting-started/beta-migration#endpoints).

## Export the Nuxt handler

```ts [server/routes/private-mcp.ts]
import { z } from 'zod'
import { createMcpHandler, defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

const greet = defineMcpTool({
  name: 'greet',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string() }),
  handler: ({ name }) => ({ greeting: `Hello ${name}!` }),
})

export default createMcpHandler({
  name: 'private-tools',
  auth: { tokens: [process.env.MCP_PRIVATE_TOKEN!] },
  tools: [greet],
})
```

This mounts `/private-mcp`. Use a route without a `.get` or `.post` suffix so the MCP engine can receive every supported HTTP method. Avoid mounting a configured server on the same path.

The Nuxt helper carries the current request and middleware context into H3 v2 and relays streamed-response disconnects. Importing the standalone runtime handler directly into a Nitro 2 Nuxt route skips that integration.

## Choose a route in configuration

For file discovery, choose an explicit route on a server:

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    servers: {
      default: { dir: 'mcp', route: '/api/mcp' },
      reports: { dir: 'mcp-reports', route: '/integrations/reports' },
    },
  },
})
```

A route name does not grant authorization. Configure authentication independently and use verified scopes for private operations.

## Keep installation links explicit

The module's badge and deeplink routes are mounted under the top-level base `mcp.route`. A manually composed route does not automatically gain its own installation routes. Point clients directly at the correct endpoint, or publish a client configuration for it.

See [sharing definitions](https://mcp-toolkit.nuxt.dev/handlers/sharing-practices), [OAuth metadata](https://mcp-toolkit.nuxt.dev/getting-started/oauth), and [connection options](https://mcp-toolkit.nuxt.dev/getting-started/connection).

## Export a reusable definition

```ts [server/shared-mcp/greet.ts]
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  name: 'greet',
  description: 'Greet someone by name',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: z.object({ name: z.string().min(1) }),
  outputSchema: z.object({ greeting: z.string() }),
  handler: ({ name }) => ({ greeting: `Hello ${name}!` }),
})
```

## Compose an endpoint

```ts [server/routes/shared-mcp.ts]
import { createMcpHandler } from '@nuxtjs/mcp-toolkit/server'
import greet from '../shared-mcp/greet'

const tools = [greet]

export default createMcpHandler({
  name: 'shared-tools',
  auth: { tokens: [process.env.MCP_SHARED_TOKEN!] },
  tools,
})
```

Place manually shared definitions outside auto-discovered roots when automatic registration is unwanted. Give them explicit names because manual composition does not infer filenames.

Collections can be readonly. A factory is optional when it helps inject an application service; exporting a definition directly is sufficient for ordinary reuse.

## Keep identity in the current event

A shared definition receives the current request context and the serving endpoint's notifier. Never capture a caller's identity or token while constructing a shared definition. Resolve identity on each invocation and constrain the application query to that user or tenant.

Do not treat a shared catalog or a tool allowlist as authorization. Keep endpoint credentials, required scopes, and application ownership checks explicit. Keep service caching keyed by all data-selection arguments, including verified identity for private results.

## Notify the serving endpoint

Inside a definition, use `event.context.mcp.notifier` for catalog or resource changes. Outside a callback, use the generated endpoint's `notify`. The engine's `event.context.mcp.notify` remains its request-scoped callable function.

See [catalog notifications](https://mcp-toolkit.nuxt.dev/advanced/dynamic-definitions) and [directory ownership](https://mcp-toolkit.nuxt.dev/handlers/organization).
