# Middleware Patterns

Middleware lives on `defineMcpHandler` — there is **no separate `defineMcpMiddleware`** function. The signature is:

```typescript
type McpMiddleware = (
  event: H3Event,
  next: () => Promise<Response>
) => Promise<Response | void> | Response | void
```

If you don't call `next()`, it's called automatically after your middleware returns. Call it explicitly if you need to inspect/modify the response or measure timing.

## Where to put middleware

| File | Effect |
| --- | --- |
| `server/mcp/index.ts` | Override the default `/mcp` handler — middleware runs for every request to the default route. |
| `server/mcp/handlers/<name>/index.ts` | Folder handler — middleware runs only for `/mcp/<name>`. Tools/resources/prompts in `handlers/<name>/{tools,resources,prompts}/` are auto-attached. |

## Soft Authentication (recommended)

::callout{icon="i-lucide-triangle-alert" color="warning"}
For manually configured API keys without OAuth metadata, set context on success and guard every protected operation. A `401` can trigger OAuth discovery. For an OAuth resource server, that is intentional: return `401` with its `WWW-Authenticate` metadata challenge. Do not apply this API-key recipe’s soft authentication to Nitro’s `createMcpOAuth` flow.
::

```typescript [server/mcp/index.ts]
export default defineMcpHandler({
  middleware: async (event) => {
    const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
    if (!apiKey) return

    const user = await verifyApiKey(apiKey).catch(() => null)
    if (user) event.context.user = user
    // No throw — unauthenticated requests still see public tools
  },
})
```

```typescript [server/mcp/tools/list-todos.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'List the current user’s todos',
  enabled: event => Boolean(event.context.user), // hidden when unauthenticated
  handler: async () => {
    const event = useEvent()
    return listTodos(event.context.user.id)
  },
})
```

For a tool that *should* surface to the LLM but can't run, return a friendly message instead of throwing:

```typescript
handler: async () => {
  const event = useEvent()
  if (!event.context.user) return 'Sign in first, then re-run this tool.'
  return listTodos(event.context.user.id)
}
```

## Better Auth API Keys

Same pattern with [`better-auth`](https://www.better-auth.com)'s API-key plugin:

```typescript [server/mcp/index.ts]
import { auth } from '~/lib/auth'

export default defineMcpHandler({
  middleware: async (event) => {
    const headers = getRequestHeaders(event)
    const session = await auth.api.getSession({ headers: new Headers(headers as Record<string, string>) })
    if (session) {
      event.context.user = session.user
      event.context.session = session.session
    }
  },
})
```

`useMcpLogger()` automatically tags every wide event with `user.id` / `user.email` / `session.id` from `event.context.user` and `event.context.session`.

## Logging Middleware (with `next()` for timing)

Use `extractToolNames` to capture which tools were called from the JSON-RPC body:

```typescript
import { extractToolNames } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  middleware: async (event, next) => {
    const requestId = crypto.randomUUID()
    event.context.requestId = requestId

    const start = performance.now()
    const response = await next()
    const tools = await extractToolNames(event)

    console.log(`[mcp] ${requestId} ${tools.join(',') || 'rpc'} took ${(performance.now() - start).toFixed(1)}ms`)
    return response
  },
})
```

For structured wide events on every MCP request, prefer [`useMcpLogger()`](https://mcp-toolkit.nuxt.dev/advanced/logging) — it tags `mcp.tool`, `mcp.session_id`, `mcp.request_id`, `service`, etc. automatically.

## Hard Reject (admin-only handler)

When middleware *must* reject (e.g. an internal admin endpoint that should never be public), return a `403` — not a `401`:

```typescript [server/mcp/handlers/admin/index.ts]
export default defineMcpHandler({
  description: 'Admin tools — IP-allowlisted.',
  middleware: async (event) => {
    const ip = getRequestIP(event, { xForwardedFor: true })
    if (!ALLOWED_IPS.includes(ip)) {
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
  },
})
```

## Rate Limiting

Lean on [`nitro-rate-limit`](https://github.com/atinux/nitro-rate-limit) or implement per-user counters using a `useStorage` driver — keep the work outside middleware so other tools' caching keeps working:

```typescript
const counters = new Map<string, { count: number, resetAt: number }>()

export default defineMcpHandler({
  middleware: async (event) => {
    const userId = event.context.user?.id ?? getRequestIP(event)
    const now = Date.now()
    const window = 60_000
    const limit = 100

    const bucket = counters.get(userId) ?? { count: 0, resetAt: now + window }
    if (now > bucket.resetAt) {
      bucket.count = 0
      bucket.resetAt = now + window
    }
    bucket.count++
    counters.set(userId, bucket)

    if (bucket.count > limit) {
      throw createError({ statusCode: 429, message: 'Rate limit exceeded' })
    }
  },
})
```

## CORS

Cross-origin browser clients are gated by `mcp.security.allowedOrigins`. Configure it in `nuxt.config.ts` rather than via middleware:

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: {
    security: {
      allowedOrigins: ['https://app.example.com'], // or '*' to disable Origin checks (use with care)
    },
  },
})
```

## Compose multiple concerns

Middleware is one function, but you can compose helpers:

```typescript
async function withAuth(event: H3Event) {
  const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!apiKey) return
  const user = await verifyApiKey(apiKey).catch(() => null)
  if (user) event.context.user = user
}

async function withRequestId(event: H3Event) {
  event.context.requestId = crypto.randomUUID()
}

export default defineMcpHandler({
  middleware: async (event, next) => {
    await withAuth(event)
    await withRequestId(event)
    return next()
  },
})
```

## See also

- [Middleware docs](https://mcp-toolkit.nuxt.dev/advanced/middleware)
- [Authentication examples](https://mcp-toolkit.nuxt.dev/examples/authentication)
- [Logging](https://mcp-toolkit.nuxt.dev/advanced/logging) — `useMcpLogger()` and evlog
