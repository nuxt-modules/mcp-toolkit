# Middleware and hooks — 1.0

## Run ordinary server middleware

Nuxt middleware runs before the MCP endpoint. The adapter preserves its context on the shared request event.

```ts [server/middleware/request-timing.ts]
import { defineEventHandler } from 'nuxt/server'

export default defineEventHandler((event) => {
  event.context.requestStartedAt = performance.now()
})
```

An application authentication service can also populate verified context. Never derive authorization from an unverified role header, supplied user ID, or arbitrary metadata.

## Authenticate the MCP endpoint

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    oauth: {
      resource: 'https://example.com/mcp',
      authorizationServers: ['https://auth.example.com'],
      jwt: { jwks: 'https://auth.example.com/.well-known/jwks.json' },
      scopesSupported: ['profile:read'],
    },
  },
})
```

Endpoint OAuth validates access tokens before operations run. Define required `scopes` on tools, resources, and prompts, and constrain private application queries to the current verified identity. A static `auth.tokens` list is also available for endpoint credentials.

Native middleware that blocks discovery metadata or replaces a 401 challenge can prevent OAuth clients from discovering the authorization server. Keep protected-resource metadata publicly discoverable and let the endpoint's OAuth integration produce the challenge.

## Read the explicit MCP event

```ts [server/mcp/tools/request-language.ts]
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  description: 'Read this request language preference',
  handler: event => ({ language: event.req.headers.get('accept-language') }),
})
```

Input tools receive `(args, event)`; no-input tools receive `event`. The MCP event uses H3 v2 even on a Nitro 2 host. APIs requiring a native H3 v1 event need host integration; do not force the type with a cast.

The old endpoint `middleware(event, next)` option and `extractToolNames` helper are removed. Use native middleware for host concerns, endpoint authentication for access, and [tool-call hooks](https://mcp-toolkit.nuxt.dev/advanced/hooks) for operation metrics. Read protocol context in the callback rather than consuming the request body in middleware.

## Record settled calls

Configured endpoints emit `mcp:tool:called` after a tool produces a result. In a Nuxt 4/Nitro 2 application:

```ts [server/plugins/mcp-metrics.ts]
import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin((app) => {
  app.hooks.hook('mcp:tool:called', ({ name, result, durationMs }) => {
    console.info({ tool: name, durationMs, failed: 'isError' in result && result.isError === true })
  })
})
```

The payload contains `name`, `result`, `durationMs`, and `event`. Application errors converted to `isError` are results too. Avoid logging complete tool arguments, tokens, or private result content.

A hook listener is awaited. If it throws, the error reaches the caller; the toolkit does not silently continue. Handle operational failures in your logging destination deliberately.

For Nitro 3, register the same hook through its native plugin API (`definePlugin` from `nitro`, and the plugin's `hooks`). Keep imports appropriate to the host.

## Observe a composed route

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
  onToolCall: ({ name, durationMs }) => {
    console.info({ tool: name, durationMs })
  },
})
```

The callback receives the same settled-call payload. Composed routes use their own callback rather than implicitly joining the configured-endpoint hook.

## Replace retired hooks

| Removed hook | Replacement |
| --- | --- |
| `mcp:definitions:paths` | Ordered roots and Nuxt layer overlays |
| `mcp:config:resolved` | Explicit endpoint configuration and current-request authorization |
| `mcp:server:created` | Definition composition and installed engine extension plugins |

The new runtime has no SDK server to mutate. Keep protocol behavior in the shared engine and application business logic in services. See [observability](https://mcp-toolkit.nuxt.dev/advanced/logging), [custom roots](https://mcp-toolkit.nuxt.dev/advanced/custom-paths), and [endpoint composition](https://mcp-toolkit.nuxt.dev/handlers/examples-routing).
