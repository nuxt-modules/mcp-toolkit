---
"@nuxtjs/mcp-toolkit": minor
---

Route MCP Apps to any named handler — no manual filtering required. Until now every `defineMcpApp` SFC was hard-attributed to the implicit `apps` handler, so multiple `app/mcp/*.vue` files could only be exposed together on `/mcp/apps`. Two new mechanisms (consistent with the rest of the module) let you split apps across handlers.

### Sub-folder convention

The first sub-directory under `app/mcp/` becomes the named-handler attribution — same idea as `server/mcp/handlers/<name>/` for tools, resources, and prompts:

```bash
app/mcp/
├── color-picker.vue          # → /mcp/apps   (default)
├── finder/
│   └── stay-finder.vue       # → /mcp/finder
└── checkout/
    └── stay-checkout.vue     # → /mcp/checkout
```

Pair each sub-folder with its handler index file (one-liner is fine):

```ts [server/mcp/handlers/finder/index.ts]
import { defineMcpHandler } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({})
```

With `defaultHandlerStrategy: 'orphans'` (the default), each app surfaces on exactly one route.

### Explicit `attachTo` / `group` / `tags` overrides

Three new fields on `defineMcpApp` let an SFC opt out of the folder convention or add filterable metadata. They override any sub-folder default:

```vue [app/mcp/stay-finder.vue]
<script setup lang="ts">
defineMcpApp({
  attachTo: 'finder',          // override → /mcp/finder
  group: 'stays',              // top-level filter for getMcpTools({ group })
  tags: ['searchable', 'demo'],// top-level filter for getMcpTools({ tags })
  // ...
})
</script>
```

The generated tool and resource carry `_meta.handler = 'finder'`, top-level `group` and `tags`, so `getMcpTools({ handler: 'finder' })` / `getMcpTools({ tags: ['searchable'] })` filters work the same way they do for ordinary tools.

### Build-time validation

`attachTo`, `group`, and `tags` must be **string literals** (e.g. `'finder'`, `['a', 'b']`). The toolkit reads them statically from the `defineMcpApp` macro at build time so routing decisions are deterministic across dev, build, and deploy. A dynamic expression (`attachTo: someVar`) fails the build with a clear message.

### Back-compat

100% additive — apps without sub-folders or explicit overrides keep their previous behaviour (attached to `apps`, surfaced on `/mcp/apps`). The previous "manual filter inside `defineMcpHandler`" workaround documented in [MCP Apps internals](https://mcp-toolkit.nuxt.dev/advanced/mcp-apps-internals#multiple-handlers) is no longer required.

See [Apps · Authoring → Routing apps to a specific handler](https://mcp-toolkit.nuxt.dev/apps/authoring#routing-apps-to-a-specific-handler).
