---
"@nuxtjs/mcp-toolkit": minor
---

Defer evlog setup to `evlog/nuxt`. The toolkit no longer registers an evlog Nitro module — install `evlog`, add `'evlog/nuxt'` to `modules`, and configure observability from the top-level `evlog: { … }` key in `nuxt.config.ts`.

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
    routes: {
      '/mcp/**': { service: 'my-app/mcp' },
    },
  },
})
```

### `mcp.logging` modes

| Value | Behavior |
|---|---|
| `undefined` (default) | On if `evlog/nuxt` is registered, off otherwise. |
| `true` | Asserts `evlog/nuxt` is registered. Build throws if it isn't. |
| `false` | Opt out. `log.notify(...)` keeps working. |

The object form of `mcp.logging` is removed — pass options under the top-level `evlog: { … }` key instead. Tag MCP traffic with a dedicated service via `evlog.routes['/mcp/**'] = { service: '…' }`.
