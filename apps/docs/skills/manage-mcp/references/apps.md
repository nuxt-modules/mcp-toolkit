# MCP Apps — Interactive UI Widgets

`defineMcpApp` lets you author Vue Single-File Components that ship to MCP-Apps-compatible hosts (ChatGPT, Cursor) as interactive iframes backed by your MCP tool handler. Available since v0.15.

The macro is extracted at build time, the SFC is bundled into a single HTML file, and the handler runs server-side so its `structuredContent` is **inlined into the iframe HTML on first paint** — no extra round-trip.

## File Convention

MCP Apps live in **`app/mcp/`** (not `server/mcp/`). They sit on the client side because they author Vue components, but the `handler` you declare runs server-side.

```bash
app/
└── mcp/
    ├── color-picker.vue          # → tool: color-picker, mounted on /mcp/apps
    ├── finder/
    │   └── stay-finder.vue       # → tool: stay-finder, mounted on /mcp/finder
    └── checkout/
        └── stay-checkout.vue     # → tool: stay-checkout, mounted on /mcp/checkout
```

The first sub-directory under `app/mcp/` becomes the **named-handler attribution**. SFCs sitting directly under `app/mcp/` go to the implicit `apps` handler. Override per-app with `attachTo`.

Override the directory via `mcp.appsDir` in `nuxt.config.ts`. The MCP Apps pipeline only runs when the directory exists — fully tree-shakable when unused.

## Quick Start

```vue [app/mcp/color-picker.vue]
<script setup lang="ts">
import { z } from 'zod'

interface PalettePayload {
  base: string
  swatches: { name: string, hex: string }[]
}

defineMcpApp({
  description: 'Pick a colour and preview a 5-tone palette.',
  inputSchema: {
    base: z.string().describe('Hex colour, e.g. #2563eb'),
  },
  handler: async ({ base }): Promise<{ structuredContent: PalettePayload }> => ({
    structuredContent: await $fetch<PalettePayload>('/api/palette', { query: { base } }),
  }),
})

const { data, loading, sendPrompt } = useMcpApp<PalettePayload>()
</script>

<template>
  <main class="picker">
    <p v-if="loading">Mixing colours…</p>
    <ul v-else-if="data" class="swatches">
      <li v-for="s in data.swatches" :key="s.hex">
        <button
          type="button"
          :style="{ background: s.hex }"
          @click="sendPrompt(`Use ${s.name} (${s.hex}) as the primary colour.`)"
        >
          {{ s.name }}
        </button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.picker { padding: 16px; font-family: system-ui, sans-serif; }
.swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; padding: 0; list-style: none; }
.swatches button { width: 100%; aspect-ratio: 1; border-radius: 8px; border: 0; cursor: pointer; }
</style>
```

The toolkit:

1. **Registers an MCP tool** named `color-picker` (auto-derived from filename).
2. Generates a **UI resource** at `ui://mcp-app/color-picker` (MIME `text/html;profile=mcp-app`).
3. Bundles the SFC + assets into a single HTML file.
4. **Inlines `structuredContent` into the iframe** so it boots with full data.

## `defineMcpApp` Options

```typescript
defineMcpApp({
  name?: string                     // Override auto-derived name
  title?: string                    // Override auto-derived title
  description?: string              // Helps the LLM pick this app
  inputSchema?: ZodRawShape         // Validates tool input on the server
  handler?: (args, extra) => Result // Server-side; defaults to (args) => ({ structuredContent: args })
  csp?: McpAppCsp | false           // Tighten or disable iframe CSP
  attachTo?: string                 // Named MCP handler to mount on (default: 'apps' or sub-folder)
  group?: string                    // Top-level group label (default: same as attachTo)
  tags?: string[]                   // Top-level tags forwarded to the generated tool
  _meta?: Record<string, unknown>   // Extra _meta surfaced to the host
})
```

If `handler` is omitted, the toolkit defaults to `(args) => ({ structuredContent: args })` — useful for stateless apps that just echo the input.

**`attachTo`, `group`, and `tags` must be string literals** (`'finder'`, `['a', 'b']`). The toolkit reads them statically at build time to route the generated tool and resource. Dynamic expressions (`attachTo: someVar`) fail the build with a clear error.

### Routing apps to a dedicated handler

```vue [app/mcp/finder/stay-finder.vue]
<script setup lang="ts">
defineMcpApp({
  attachTo: 'finder',     // explicit override (sub-folder default would also be 'finder' here)
  group: 'stays',
  tags: ['searchable'],
  // ...
})
</script>
```

Then add the handler index file:

```ts [server/mcp/handlers/finder/index.ts]
import { defineMcpHandler } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({})
```

The app now only surfaces on `/mcp/finder` (with `defaultHandlerStrategy: 'orphans'`). Filter further with `getMcpTools({ handler: 'finder' })`, `getMcpTools({ tags: ['searchable'] })`, etc.

## `useMcpApp<T>()` Bridge

Auto-imported into every MCP App SFC. Returns the iframe ↔ host bridge:

```typescript
const {
  data,         // Ref<T | null>            — hydrated from structuredContent, refreshed by callTool
  loading,      // Ref<boolean>             — true until first payload arrives
  error,        // Ref<Error | null>        — bridge / transport / payload errors
  pending,      // Ref<boolean>             — true while a callTool() is in flight
  hostContext,  // Ref<HostContext | null>  — theme, displayMode, locale, …
  callTool,     // (name, params?) => Promise<T | null>
  sendPrompt,   // (prompt: string) => void
  openLink,     // (url: string) => void
} = useMcpApp<MyPayload>()
```

### Adapt to host theme & layout

```vue
<script setup lang="ts">
const { hostContext } = useMcpApp()
const isDark = computed(() => hostContext.value?.theme === 'dark')
const isFullscreen = computed(() => hostContext.value?.displayMode === 'fullscreen')
</script>

<template>
  <main :data-theme="isDark ? 'dark' : 'light'" :data-mode="isFullscreen ? 'fullscreen' : 'inline'">
    <!-- … -->
  </main>
</template>
```

`hostContext` is `null` on the first paint and populates after the handshake (~50ms).

### `sendPrompt(prompt)` — follow-ups

Push a message into the chat as if the user typed it — enables app-to-app workflows:

```vue
<button @click="sendPrompt(`Use ${swatch.name} as the brand colour.`)">
  Use this colour
</button>
```

### `callTool(name, params)` — in-place refresh

Re-invoke any MCP tool from the iframe; the result replaces `data` automatically:

```vue
<script setup lang="ts">
const { data, pending, callTool } = useMcpApp<PalettePayload>()
async function refresh(base: string) {
  await callTool('color-picker', { base })
}
</script>
```

### `openLink(url)`

Sandboxed iframes can't open windows. `openLink` asks the host to open a URL in a new tab:

```vue
<button @click="openLink('https://example.com/learn-more')">
  Learn more
</button>
```

## CSP (Content Security Policy)

Every app HTML ships with a strict CSP by default. Allow-list extra origins:

```typescript
defineMcpApp({
  csp: {
    resourceDomains: ['https://images.example.com'], // <img>, <style>, fonts
    connectDomains: ['https://api.example.com'],     // fetch / XHR / WebSocket
  },
  // ...
})
```

CSP origins are validated at build time (only `http(s)://` / `ws(s)://`, no path/query/quote characters) and mirrored into `_meta.ui.csp` and `_meta['openai/widgetCSP']` for hosts that enforce CSP themselves.

Set `csp: false` to opt out (not recommended).

## Sharing Types Between Server & UI

Place shared types in Nuxt's `shared/types/` directory — they're auto-imported globally in both the SFC and your API endpoints, no `import` needed:

```typescript [shared/types/palette.ts]
export interface Swatch { name: string, hex: string }
export interface PalettePayload { base: string, swatches: Swatch[] }
```

```typescript [server/api/palette.get.ts]
export default defineEventHandler(async (event): Promise<PalettePayload> => {
  const { base } = getQuery(event)
  return { base: String(base), swatches: buildPalette(String(base)) }
})
```

```vue [app/mcp/color-picker.vue]
<script setup lang="ts">
defineMcpApp({
  inputSchema: { base: z.string() },
  handler: async ({ base }): Promise<{ structuredContent: PalettePayload }> => ({
    structuredContent: await $fetch('/api/palette', { query: { base } }),
  }),
})

const { data } = useMcpApp<PalettePayload>()
</script>
```

Type-only references are stripped from the browser bundle by esbuild — nothing has to resolve inside the iframe at runtime.

## Testing & Publishing

### Local dev

Run `pnpm dev` and connect Cursor / Claude / ChatGPT to `http://localhost:3000/mcp` (or your custom route). The DevTools MCP Inspector also previews each app inline.

### Production

Apps require **HTTPS** in production hosts. Deploy your Nuxt app, point your client at the production MCP URL — the rest is automatic.

## See also

- [Apps overview](https://mcp-toolkit.nuxt.dev/apps/overview)
- [Authoring & defineMcpApp](https://mcp-toolkit.nuxt.dev/apps/authoring)
- [useMcpApp() bridge](https://mcp-toolkit.nuxt.dev/apps/use-mcp-app)
- [CSP & build pipeline](https://mcp-toolkit.nuxt.dev/apps/csp-and-wiring)
- [Testing & publishing](https://mcp-toolkit.nuxt.dev/apps/testing-publishing)
- [Patterns & limits](https://mcp-toolkit.nuxt.dev/apps/patterns-reference)
