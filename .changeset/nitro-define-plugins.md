---
'nitro-mcp-toolkit': minor
---

Add `defineMcpPlugins`, so `server/mcp/plugins.ts` is typechecked without a type annotation

The plugins file is imported only by the generated handler, which is not typechecked with your app. Wrapping its default export replaces the `satisfies ExtensionPlugin[]` the convention used to need, and reports a misspelled `id` or hook where you wrote it:

```ts
// server/mcp/plugins.ts
import { mcpTasks } from 'h3-mcp/tasks'
import { defineMcpPlugins } from 'nitro-mcp-toolkit'

export default defineMcpPlugins([mcpTasks({ max: 100 })])
```

The previous form keeps working — the helper returns the array unchanged, and `ExtensionPlugin` is still exported.
