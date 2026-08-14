# Handlers — Multi-Endpoint Organization

`defineMcpHandler` defines a custom MCP endpoint with its own middleware, set of tools/resources/prompts, and metadata. Use it to:

- Override the default `/mcp` route (`server/mcp/index.ts`).
- Mount additional endpoints at `/mcp/<name>` (`server/mcp/handlers/<name>/index.ts`).
- Filter exposed definitions per request (e.g. `tools: event => getMcpTools({ event, tags: ['public'] })`).

## Folder Convention (recommended)

Drop a handler folder under `server/mcp/handlers/<name>/` and the toolkit auto-attaches every tool, resource, and prompt inside it to that handler — no manual filters, no `tools: [...]` arrays.

```
server/mcp/
├── tools/                            # → /mcp (default handler)
├── resources/
├── prompts/
└── handlers/
    ├── admin/
    │   ├── index.ts                  # defineMcpHandler({ middleware: requireAdmin })
    │   ├── tools/
    │   │   └── delete-user.ts        # → /mcp/admin (auto)
    │   └── prompts/
    │       └── help.ts               # → /mcp/admin (auto)
    └── apps/
        ├── index.ts                  # defineMcpHandler({ description: 'Interactive widgets' })
        └── tools/                    # → /mcp/apps (auto)
```

```typescript [server/mcp/handlers/admin/index.ts]
export default defineMcpHandler({
  description: 'Admin tools — IP-allowlisted, destructive operations.',
  instructions: 'Always confirm destructive actions with the operator before running.',
  middleware: async (event) => {
    const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
    const user = apiKey ? await verifyAdmin(apiKey).catch(() => null) : null
    if (user) event.context.user = user
    // Soft auth: tools use `enabled: e => Boolean(e.context.user)` to hide themselves
  },
  // tools / resources / prompts omitted → auto-attached from handlers/admin/{tools,resources,prompts}/
})
```

The handler `name` is inferred from the folder (`admin`) and **wins over** anything you set in `index.ts`.

::callout{icon="i-lucide-lightbulb" color="primary"}
`index.ts` is required, even if it's a one-liner: `export default defineMcpHandler({})`. It's what registers the `/mcp/<name>` route and is where you add `middleware`, `description`, `experimental_codeMode`, etc.
::

## Default Handler Strategy

The default `/mcp` route obeys `mcp.defaultHandlerStrategy` in `nuxt.config.ts`:

| Value | Behavior |
| --- | --- |
| `'orphans'` (default) | Only definitions **not attached** to any named handler. Each definition lives in exactly one place. When no folder handlers exist, every definition is an orphan, so it falls back to "expose everything" — zero-effort back-compat. |
| `'all'` | Every discovered definition (the kitchen-sink route). Useful when you want a default route on top of specialized ones. |

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: {
    defaultHandlerStrategy: 'orphans', // default
  },
})
```

## Function Form (the escape hatch)

For cross-cutting cases — "every tool tagged X", "every orphan", "everything except admin" — pass a function that calls one of the `getMcp*` helpers:

```typescript [server/mcp/handlers/searchable/index.ts]
import { defineMcpHandler, getMcpTools } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  // Every tool tagged 'searchable', regardless of folder
  tools: event => getMcpTools({ event, tags: ['searchable'] }),
})
```

`getMcpTools`, `getMcpResources`, `getMcpPrompts` return **raw** definitions (with handlers and Zod schemas intact) — exactly what `defineMcpHandler` expects.

Clients can subset the catalog per connection with `X-MCP-Tools` (comma-separated names matching `tools/list`). Unknown names return HTTP 400. Applied after custom `tools:` callbacks, `enabled()`, and `mcp:config:resolved`. No custom handler required.

## All `defineMcpHandler` Options

```typescript
defineMcpHandler({
  name?: string                   // Required for non-folder handlers; auto-derived from folder otherwise
  version?: string                // Defaults to mcp.version
  description?: string            // serverInfo description shown by clients
  instructions?: string           // System-prompt guidance for LLMs
  icons?: McpIcon[]               // Server icons in client UIs
  route?: string                  // Custom mount path (defaults to /mcp/<name>)
  browserRedirect?: string        // Where to redirect browser GETs
  middleware?: McpMiddleware      // Request-time auth/logging/etc.
  tools?: ToolDef[] | ((event) => ToolDef[] | Promise<ToolDef[]>)
  resources?: ResourceDef[] | ((event) => …)
  prompts?: PromptDef[] | ((event) => …)
  experimental_codeMode?: boolean | CodeModeOptions
})
```

`description` / `instructions` / `icons` fall back to `mcp.*` from `nuxt.config.ts` if omitted, so you only need to set them per-handler when an endpoint has its own identity.

## Resolution Rule

The toolkit picks where each definition shows up using one deterministic rule based on file location:

| Handler config file | Default for `tools \| resources \| prompts: undefined` |
| --- | --- |
| `server/mcp/index.ts` | Obeys `defaultHandlerStrategy` |
| `server/mcp/handlers/<name>/index.ts` | Definitions attributed to `<name>` |
| `server/mcp/<name>.ts` (top-level) | Every discovered definition (back-compat) |
| Array | Used as-is |
| Function `(event) => T[]` | Called per request |

## Listing Definitions (`listMcp*` / `getMcp*`)

Read your discovered catalog programmatically — useful for [server cards](https://modelcontextprotocol.io/specification/2025-11-25/basic/server-cards), admin dashboards, sitemaps, or feeding back into a custom handler.

| Helper | Returns |
| --- | --- |
| `listMcpTools(options?)` | `McpToolSummary[]` (JSON-friendly: `name`, `title`, `description`, `group`, `tags`, `handler`) |
| `listMcpResources(options?)` | `McpResourceSummary[]` (with `uri`) |
| `listMcpPrompts(options?)` | `McpPromptSummary[]` |
| `listMcpDefinitions(options?)` | `{ tools, resources, prompts }` |
| `getMcpTools(options?)` | `McpToolDefinitionListItem[]` (raw, with handlers + Zod) |
| `getMcpResources(options?)` | `McpResourceDefinition[]` (raw) |
| `getMcpPrompts(options?)` | `McpPromptDefinition[]` (raw) |

Filters (combine with AND semantics):

| Option | Type | Description |
| --- | --- | --- |
| `event` | `H3Event` | Apply per-definition `enabled()` guards using request context |
| `group` | `string \| string[]` | OR-match a group |
| `tags` | `string \| string[]` | OR-match a tag |
| `handler` | `string \| string[]` | Definitions attached to one of these named handlers |
| `orphansOnly` | `boolean` | Only orphan definitions (mutually exclusive with `handler`) |

### Public catalog (server card)

```typescript [server/routes/.well-known/mcp/server-card.json.get.ts]
import { listMcpDefinitions } from '@nuxtjs/mcp-toolkit/server'

export default defineEventHandler(async (event) => {
  const { tools, resources, prompts } = await listMcpDefinitions({ event })
  return {
    name: 'My MCP Server',
    description: 'Tools, resources, and prompts exposed by my Nuxt app.',
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    resources: resources.map(r => ({ name: r.name, uri: r.uri })),
    prompts: prompts.map(p => ({ name: p.name, description: p.description })),
  }
})
```

### Cached server card

```typescript [server/routes/.well-known/mcp/server-card.json.get.ts]
import { listMcpDefinitions } from '@nuxtjs/mcp-toolkit/server'

export default defineCachedEventHandler(async (event) => {
  const definitions = await listMcpDefinitions({ event })
  return { name: 'My MCP Server', ...definitions }
}, { maxAge: 60 * 60, swr: true })
```

::callout{icon="i-lucide-triangle-alert" color="warning"}
Skip the cache wrapper if you pass `event` for `enabled()` guards that depend on per-request context (auth, headers) — caching would freeze the response for the first request.
::

### Filter examples

```typescript
const adminTools = await listMcpTools({ group: 'admin' })
const publicOrDocs = await listMcpTools({ tags: ['public', 'docs'] })
const adminCatalog = await listMcpTools({ handler: 'admin' })
const orphans = await listMcpTools({ orphansOnly: true })

// Combine: admin tools tagged 'destructive', visible to the current request
const adminDestructive = await listMcpTools({ event, handler: 'admin', tags: 'destructive' })
```

## Migration Tips

1. **Start small.** Move one handler at a time into `handlers/<name>/`. Existing `tools: [...]` and `tools: ev => [...]` keep working untouched.
2. **Drop manual filters.** If you were doing `tools: allTools.filter(t => t._meta?.group === 'apps')`, move those tools into `handlers/apps/tools/` and let the system attribute them automatically.
3. **Wrap-everything handlers.** A top-level handler at `server/mcp/<name>.ts` (e.g. a code-mode wrapper) keeps its current behaviour — it defaults to the full pool. To filter, pass a function: `tools: ev => getMcpTools({ event: ev, ... })`.
4. **Force the old behaviour.** Set `mcp.defaultHandlerStrategy: 'all'` to keep `/mcp` exposing everything even after you adopt folder handlers.

## See also

- [Handlers overview](https://mcp-toolkit.nuxt.dev/handlers/overview)
- [Default & custom handlers](https://mcp-toolkit.nuxt.dev/handlers/default-and-custom)
- [Multi-handler organization](https://mcp-toolkit.nuxt.dev/handlers/organization)
- [Structure & options](https://mcp-toolkit.nuxt.dev/handlers/structure-and-options)
- [Listing definitions](https://mcp-toolkit.nuxt.dev/advanced/listing-definitions)
