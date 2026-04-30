---
"@nuxtjs/mcp-toolkit": minor
---

Add multi-handler organization: every auto-discovered tool, resource, or prompt can now be attributed to a named handler without manual filtering. One folder convention, one function-based escape hatch.

### Folder convention (the way to attribute)

Drop a definition under `server/mcp/handlers/<name>/{tools,resources,prompts}/` and it's auto-attached to the named handler `<name>` (mounted at `/mcp/<name>`). The handler `index.ts` is required, even as a one-liner — it's what registers the route:

```
server/mcp/handlers/admin/
├── index.ts              # export default defineMcpHandler({ middleware: requireAdmin })
├── tools/delete-user.ts  # → /mcp/admin (auto)
└── prompts/help.ts       # → /mcp/admin (auto)
```

### `getMcp*` raw helpers (the escape hatch)

For cross-cutting cases — "every tool tagged X", "every orphan", "everything except this group" — pass a function that calls one of the new raw helpers. They return full definition objects (with handlers and Zod schemas), exactly what `defineMcpHandler` expects:

```ts
import { defineMcpHandler, getMcpTools } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  tools: event => getMcpTools({ event, tags: ['searchable'] }),
})
```

`getMcpTools`, `getMcpResources`, and `getMcpPrompts` accept the same options as `listMcp*`.

### Default handler strategy

New `mcp.defaultHandlerStrategy` config (default `'orphans'`) controls which definitions land on `/mcp` when named handlers exist. With `'orphans'`, each definition shows up in exactly one place. Set to `'all'` to keep the pre-multi-handler behaviour.

### `listMcp*` filters + summary `handler`

The listing helpers gain two new options:

- `handler` (`string | string[]`) — keep only definitions attributed to one of these named handlers.
- `orphansOnly` (`boolean`) — keep only orphan definitions.

Each summary now exposes a `handler?: string` field with the attributed handler name (or undefined for orphans).

### Back-compat

100% additive when you don't use the new convention — apps without `server/mcp/handlers/` see no behaviour change. Top-level handler files (`server/mcp/<name>.ts`) keep their pre-feature behaviour: when `tools` is omitted, the full pool is exposed (so code-mode-style wrappers continue to work without any change). Existing `tools: [...]` and `tools: ev => ...` patterns also keep working.

```ts
// Before — manual filtering
export default defineMcpHandler({
  name: 'apps',
  tools: allTools.filter(t => t._meta?.group === 'apps'),
})

// After — folder convention (move to server/mcp/handlers/apps/, drop the filter)
export default defineMcpHandler({
  description: 'Apps handler',
})
```

See [`/handlers/organization`](https://mcp-toolkit.nuxt.dev/handlers/organization) for the full guide.
