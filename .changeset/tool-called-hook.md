---
"@nuxtjs/mcp-toolkit": minor
---

Add the `mcp:tool:called` Nitro runtime hook. It fires once per tool call with the tool `name`, its normalized `result`, `durationMs` and the request `event`, after the tool settles. Cache hits are included, and a thrown error arrives as an `isError` result, so the hook can feed usage metrics or audit logs.

```ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:tool:called', ({ name, result, durationMs }) => {
    metric('mcp.tool.duration_ms', durationMs, { toolName: name, outcome: result.isError ? 'error' : 'success' })
  })
})
```

The runtime hook types (`mcp:config:resolved`, `mcp:server:created`, `mcp:tool:called`) now load in the server tsconfig. They were added to `include` without their extension, so `nitroApp.hooks.hook('mcp:…')` did not typecheck in server code.
