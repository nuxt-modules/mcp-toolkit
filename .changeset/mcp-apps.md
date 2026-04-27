---
'@nuxtjs/mcp-toolkit': minor
---

**MCP Apps** — author interactive UI widgets as Vue Single-File Components and ship them to MCP Apps-compatible hosts such as Cursor and ChatGPT.

### Authoring

Drop a `.vue` file in `app/mcp/`, declare the tool with `defineMcpApp`, and the toolkit takes care of the rest:

```vue
<script setup lang="ts">
import { z } from 'zod'

defineMcpApp({
  description: 'Pick a colour and preview a palette.',
  inputSchema: { base: z.string().describe('Hex colour, e.g. #2563eb') },
  handler: async ({ base }) => ({
    structuredContent: await $fetch('/api/palette', { query: { base } }),
  }),
})

const { data, sendPrompt } = useMcpApp()
</script>

<template>
  <button v-for="s in data?.swatches" :key="s.hex" @click="sendPrompt(`Use ${s.name}`)">
    {{ s.name }}
  </button>
</template>
```

Each SFC becomes:

- a `defineMcpTool`-style tool registered on the handler,
- a `text/html;profile=mcp-app` UI resource at `ui://mcp-app/<name>`,
- a single-file HTML bundle (Vue runtime + your code + scoped CSS) served inline.

The handler runs server-side and returns `structuredContent`, which is inlined into the bundled HTML so the iframe boots **with full data on the first paint** — no extra round-trip, no flicker.

### Single client-side composable

`useMcpApp<T>()` is auto-imported into every `app/mcp/*.vue` SFC and exposes the full surface:

- `data`, `loading`, `error`, `pending` — reactive state.
- `hostContext` — theme, display mode, container size, locale, time zone, platform.
- `callTool(name, params)` — re-invoke any MCP tool and refresh `data` in place.
- `sendPrompt(prompt)` — push a follow-up into the chat to trigger another tool/app.
- `openLink(url)` — ask the host to open a URL outside the iframe sandbox.

The host bridge transparently negotiates between modern JSON-RPC, the legacy `mcp-ui` envelope, and the ChatGPT Apps SDK globals.

### Security defaults

Every app HTML ships with a strict Content Security Policy. Allow external assets per app via:

```ts
defineMcpApp({
  csp: {
    resourceDomains: ['https://images.example.com'], // <img>, <style>, fonts
    connectDomains: ['https://api.example.com'],     // fetch / XHR / WebSocket
  },
})
```

CSP origins are validated at build time (only `http(s)://` / `ws(s)://`, no path/query/quote characters), and the same allow-list is mirrored into `_meta.ui.csp` and `_meta['openai/widgetCSP']` for hosts that enforce CSP themselves.

### Tree-shakable

The MCP Apps pipeline is fully optional: when no `app/mcp/` directory exists, none of the runtime, the macro, or the auto-imports are emitted.

### Docs

- [Apps guide](https://mcp-toolkit.nuxt.dev/apps/overview) — full authoring walkthrough, host context, follow-ups, host compatibility matrix.
- [MCP Apps internals](https://mcp-toolkit.nuxt.dev/advanced/mcp-apps-internals) — build pipeline, host bridge protocol, security model, advanced patterns.
