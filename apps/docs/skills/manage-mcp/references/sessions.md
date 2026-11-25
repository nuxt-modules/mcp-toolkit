# Application state — 1.0

## Separate application state from transport

The modern protocol has no session identifier. Authentication and capabilities belong to the current request. A user preference, draft, or workflow must therefore have an application identity and storage model of its own.

The beta removes `mcp.sessions`, `useMcpSession`, and `invalidateMcpSession`. Use application storage keyed by verified user and tenant identity, or explicit opaque handles passed as tool arguments. Reauthorize every read and mutation.

## Store preferences for a verified user

This example uses Nitro 2 storage and requires endpoint OAuth with `preferences:write`:

```ts [server/mcp/tools/save-preferences.ts]
import { useStorage } from 'nitropack/runtime'
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

const preferences = z.object({ theme: z.enum(['light', 'dark']) })

export default defineMcpTool({
  description: 'Save display preferences for the verified user',
  scopes: ['preferences:write'],
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  inputSchema: preferences,
  outputSchema: preferences,
  handler: async (values, event) => {
    const userId = event.context.oauth?.sub
    if (!userId) throw new Error('A verified user is required.')
    await useStorage('mcp').setItem(`preferences:${encodeURIComponent(userId)}`, values)
    return values
  },
})
```

Configure a durable/shared storage mount for production:

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  nitro: {
    storage: { mcp: { driver: 'redis', url: process.env.REDIS_URL } },
  },
})
```

The storage configuration supplements your OAuth setup; it does not authenticate users. In a multi-tenant application include the verified tenant in the key as well. Choose storage, retention, and concurrency controls for your application's data.

## Carry a signed continuation

```ts [server/utils/continuation-state.ts]
import { defineRequestState } from '@nuxtjs/mcp-toolkit/server'
import { z } from 'zod'

const key = process.env.MCP_STATE_SECRET
if (!key) throw new Error('MCP_STATE_SECRET is required.')

export const continuation = defineRequestState<{ draftId: string }>({
  key,
  ttlMs: 300_000,
  bind: (event) => {
    const { sub } = z.object({ sub: z.string().min(1) }).parse(event.context.oauth)
    return sub
  },
})
```

Use `continuation.seal(payload, event)` when returning a modern input-required result and `continuation.open(event)` before trusting echoed state. The key must be at least 32 UTF-8 bytes and shared across every instance that can resume the flow.

The binder receives a generic H3 event, so it validates the identity value it reads. Signed state is readable, expires, and is not automatically single-use. Keep secrets out of it. The binding must require a real verified principal; use server-side records when replay prevention is needed. Authorization still runs on every round.

See [elicitation](https://mcp-toolkit.nuxt.dev/advanced/elicitation) for a complete request/retry example.

## Enable legacy protocol sessions when needed

`mcp.session: true` enables the shared engine's legacy session handling. `session: { maxSessions: 1000 }` bounds its session count. It does not create a durable user store or change modern requests into session-based requests.

Test the intended legacy client and deployment topology. Keep application state independent of whether a transport session is present.
