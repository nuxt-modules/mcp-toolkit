---
"@nuxtjs/mcp-toolkit": minor
---

Defer evlog setup to `evlog/nuxt`, and auto-tag MCP wide events with sensible defaults.

The toolkit no longer registers an evlog Nitro module — install `evlog`, add `'evlog/nuxt'` to `modules`, and configure observability from the top-level `evlog: { … }` key in `nuxt.config.ts`. In return, the integration gets dramatically more value out-of-the-box:

- **Auto `service` for MCP traffic.** When `evlog/nuxt` is registered, the toolkit injects `evlog.routes['/mcp/**'] = { service: '<evlog.env.service>/mcp' }` (or slugified `mcp.name`) unless you've pinned the route yourself.
- **Auto `user.*` / `session.*` tagging.** After your MCP middleware runs, the toolkit reads `event.context.user` (`id`, `email`, `name`), `event.context.userId`, and `event.context.session.id` and tags the wide event with the canonical schema every drain understands. Works with better-auth, custom API key handlers, anything that follows the Nuxt context convention.
- **`setUser` / `setSession` helpers** on `useMcpLogger()` for tools that want to enrich beyond what middleware sets.

### Migration

```ts
// Before
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    logging: {
      env: { service: 'my-app' },
      sampling: { rates: { info: 30 } },
    },
  },
})

// After
export default defineNuxtConfig({
  modules: ['evlog/nuxt', '@nuxtjs/mcp-toolkit'],
  evlog: {
    env: { service: 'my-app' },
    sampling: { rates: { info: 30 } },
    // No need to pin `routes['/mcp/**']` — auto-tagged with `my-app/mcp`.
  },
})
```

### `mcp.logging` modes

| Value | Behavior |
|---|---|
| `undefined` (default) | On if `evlog/nuxt` is registered, off otherwise. |
| `true` | Asserts `evlog/nuxt` is registered. Build throws if it isn't. |
| `false` | Opt out. `log.notify(...)` keeps working. |

The object form of `mcp.logging` is removed — pass options under the top-level `evlog: { … }` key instead.
