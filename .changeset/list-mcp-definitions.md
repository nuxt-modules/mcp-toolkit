---
"@nuxtjs/mcp-toolkit": minor
---

Add `listMcpTools`, `listMcpResources`, `listMcpPrompts`, and `listMcpDefinitions` helpers to read the toolkit's discovered tools, resources, and prompts from your own server routes — without duplicating their names and descriptions.

### Usage

```ts
// server/routes/.well-known/mcp/server-card.json.get.ts
import { listMcpDefinitions } from '@nuxtjs/mcp-toolkit/server'

export default defineEventHandler(async (event) => {
  const { tools, resources, prompts } = await listMcpDefinitions({ event })
  return {
    name: 'My MCP Server',
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    resources: resources.map(r => ({ name: r.name, uri: r.uri, description: r.description })),
    prompts: prompts.map(p => ({ name: p.name, description: p.description })),
  }
})
```

Each helper returns JSON-friendly summaries (`name`, `title`, `description`, `group`, `tags` — plus `uri` for resources). Names auto-generated from filenames are already resolved, so what you get matches exactly what an MCP client sees in `tools/list`.

### Filtering

Every helper accepts a `ListMcpDefinitionsOptions` object — filters compose with AND semantics:

- `event` — apply per-definition `enabled()` guards using the request context.
- `group` (`string | string[]`) — only include definitions in one of these groups (OR-match).
- `tags` (`string | string[]`) — only include definitions with at least one of these tags (OR-match).

```ts
const adminDestructive = await listMcpTools({
  event,
  group: 'admin',
  tags: 'destructive',
})
```

The new helpers are also auto-imported on the server (when `autoImports` is enabled), so you can use them without importing.
