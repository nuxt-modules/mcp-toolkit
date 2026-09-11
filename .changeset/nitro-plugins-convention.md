---
'nitro-mcp-toolkit': minor
---

`server/mcp/plugins.ts`, beside `tools/`, `resources/` and `prompts/`, installs h3-mcp extension plugins on that endpoint. Its default export is the array, and `ExtensionPlugin` is now re-exported so the file can name the type it satisfies. A plugin is a live function, so this is how one reaches a generated handler — `mcp()` options cross into generated code as JSON. The file belongs to whichever `mcp()` scans its directory, `.js` / `.mts` / `.mjs` work too, creating it in development needs no restart, and each build names the file it installed.

```ts
// server/mcp/plugins.ts
import { mcpTasks } from 'h3-mcp/tasks'
import type { ExtensionPlugin } from 'nitro-mcp-toolkit'

export default [mcpTasks({ max: 100 })] satisfies ExtensionPlugin[]
```
