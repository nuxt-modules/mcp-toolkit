---
"@nuxtjs/mcp-toolkit": minor
---

Expose two Nitro runtime hooks for the MCP request lifecycle. Subscribe from a `server/plugins/*.ts` plugin to inject custom logic without owning a `defineMcpHandler` — listeners that throw are logged via consola and the request continues.

```
defineMcpHandler middleware → mcp:config:resolved → createMcpServer → mcp:server:created → transport
```

### `mcp:config:resolved`

Fires per request after dynamic `tools` / `resources` / `prompts` resolvers and `enabled(event)` guards have run, **before** the per-request `McpServer` is built. Mutate `ctx.config` in place to add, remove or transform definitions for this request only.

```ts [server/plugins/mcp-filter.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:config:resolved', ({ config, event }) => {
    if (!event.context.user) {
      config.tools = config.tools.filter(t => !t.tags?.includes('admin'))
    }
  })
})
```

### `mcp:server:created`

Fires per request after every tool / resource / prompt has been registered, **before** the server is connected to the transport. Receives the SDK `McpServer` instance — call `server.registerTool(...)` to add definitions late, or use `getSdkServer(server)` to reach the low-level `Server` and `setRequestHandler(...)` for custom JSON-RPC methods.

```ts [server/plugins/mcp-whoami.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:server:created', ({ server, event }) => {
    server.registerTool(
      'whoami',
      { description: 'Return the current user id' },
      async () => ({
        content: [{ type: 'text', text: String(event.context.userId ?? 'anonymous') }],
      }),
    )
  })
})
```

### Public API additions

- `McpResolvedConfig` — type of the resolved per-request server config.
- `getSdkServer(server)` — reach the underlying SDK `Server` instance from an `McpServer`.

Both are exported from `@nuxtjs/mcp-toolkit/server`. See [Hooks · Runtime hooks](https://mcp-toolkit.nuxt.dev/advanced/hooks#runtime-hooks).
