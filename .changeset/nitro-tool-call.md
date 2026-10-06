---
"nitro-mcp-toolkit": minor
---

Report tool calls. `createMcpHandler({ onToolCall })` is called once per tool call that settles into a result, with the tool `name`, the `result` the client receives, `durationMs` and the `event`. Endpoints served by `mcp()` forward it to the `mcp:tool:called` Nitro runtime hook, so a Nitro plugin can feed usage metrics or audit logs:

```ts
export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:tool:called', ({ name, result, durationMs }) => {
    metric('mcp.tool.duration_ms', durationMs, { toolName: name })
  })
})
```
