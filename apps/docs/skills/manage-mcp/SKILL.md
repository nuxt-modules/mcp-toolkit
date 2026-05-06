---
name: manage-mcp
description: Manage MCP servers in Nuxt with @nuxtjs/mcp-toolkit — setup, create tools/resources/prompts, organize with handlers, build interactive MCP Apps, add elicitation/logging/sessions, review, and troubleshoot.
---

# Manage MCP

Complete skill for managing Model Context Protocol (MCP) servers in Nuxt with [`@nuxtjs/mcp-toolkit`](https://mcp-toolkit.nuxt.dev). Setup, create tools/resources/prompts, organize with multi-handler folder convention, build interactive UI widgets (MCP Apps), wire up sessions and observability, review, and troubleshoot.

## When to Use

- **Setup**: "Setup an MCP server in my Nuxt app", "Add MCP to Nuxt"
- **Create**: "Add a tool that calculates BMI", "Expose a README as a resource", "Create a code-review prompt"
- **Organize**: "Split my MCP into admin + public endpoints", "Filter tools per user"
- **Customize**: "Add authentication to my MCP", "Log every tool call to Axiom", "Stream progress to the client"
- **Build apps**: "Add an interactive Vue widget callable from ChatGPT/Cursor"
- **Persist state**: "Remember the user across tool calls in one session"
- **Review**: "Review my MCP implementation", "Check for best practices"
- **Troubleshoot**: "My tool isn't discovered", "Auto-imports don't work", "OAuth flow keeps triggering"
- **Test**: "Eval which tools the model picks for these prompts"

---

## Setup MCP Server

### Installation

::code-group
```bash [pnpm]
pnpm add @nuxtjs/mcp-toolkit zod
```
```bash [npm]
npm install @nuxtjs/mcp-toolkit zod
```
```bash [yarn]
yarn add @nuxtjs/mcp-toolkit zod
```
```bash [bun]
bun add @nuxtjs/mcp-toolkit zod
```
::

Or in one go via the Nuxt CLI:

```bash
npx nuxt module add mcp-toolkit
```

Add to `nuxt.config.ts`:

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'My MCP Server',
    description: 'Read and update todos for the current user.',
  },
  nitro: {
    experimental: { asyncContext: true }, // required for useEvent / useMcpServer / useMcpLogger
  },
})
```

### Directory Structure

```
server/mcp/
├── tools/                 # Actions the AI can perform
│   └── admin/             # Subdirectory → group: 'admin'
├── resources/             # Data the AI can read
├── prompts/               # Reusable message templates
└── handlers/              # Optional: named handlers mounted at /mcp/<name>
    └── admin/
        ├── index.ts       # defineMcpHandler({ middleware: requireAdmin })
        ├── tools/         # auto-attached to /mcp/admin
        └── resources/

app/mcp/                   # Optional: MCP Apps (interactive Vue widgets)
└── palette.vue            # → app `palette`, callable from ChatGPT / Cursor
```

### Verification

1. Start the dev server: `pnpm dev`
2. Hit the endpoint: `curl http://localhost:3000/mcp` (responds to MCP JSON-RPC)
3. Open Nuxt DevTools (Shift+Alt+D) → **MCP** tab — bundled MCP Inspector for live testing.

---

## Create Tools

Tools are functions AI assistants can call. Auto-discovered from any `.ts`/`.js` file under `server/mcp/tools/`.

### Basic Tool

```typescript [server/mcp/tools/echo.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Echo a message back to the user',
  inputSchema: {
    message: z.string().describe('Text to echo'),
  },
  handler: async ({ message }) => {
    return `Echo: ${message}` // string is auto-wrapped into a text content item
  },
})
```

`name` and `title` are auto-derived from the filename (`echo.ts` → `name: 'echo'`, `title: 'Echo'`). Override either by setting them explicitly.

### Return Values

Handlers can return any of these — the toolkit normalizes them:

| Return | Wrapped as |
| --- | --- |
| `string` / `number` / `boolean` | `{ content: [{ type: 'text', text: String(v) }] }` |
| Plain object / array | JSON-stringified into a text content item |
| `imageResult(base64, mime)` | `{ content: [{ type: 'image', data, mimeType }] }` |
| `audioResult(base64, mime)` | `{ content: [{ type: 'audio', data, mimeType }] }` |
| Full `CallToolResult` | Passed through (use for `structuredContent`, embedded resources, multi-content) |
| Thrown error | Caught and converted to `isError: true`. `createError({ statusCode, message })` from h3 includes the status code in the response. |

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Get a user by ID',
  inputSchema: { id: z.string().describe('User ID') },
  handler: async ({ id }) => {
    const user = await getUser(id)
    if (!user) throw createError({ statusCode: 404, message: 'User not found' })
    return user // plain object — auto-stringified
  },
})
```

For typed structured output, pair `outputSchema` with a `structuredContent` return:

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Calculate Body Mass Index',
  inputSchema: {
    height: z.number().describe('Height in meters'),
    weight: z.number().describe('Weight in kilograms'),
  },
  outputSchema: {
    bmi: z.number(),
    category: z.string(),
  },
  handler: async ({ height, weight }) => {
    const bmi = weight / (height * height)
    const category = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese'
    return { structuredContent: { bmi, category } }
  },
})
```

### Annotations & Input Examples

Behavioral hints that help clients decide whether to prompt for confirmation:

```typescript
export default defineMcpTool({
  description: 'Delete a user account',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: { id: z.string() },
  inputExamples: [{ id: 'usr_42' }, { id: 'admin' }],
  handler: async ({ id }) => {
    await deleteUser(id)
    return `Deleted ${id}.`
  },
})
```

Common patterns: read-only → `readOnlyHint: true`; create → `idempotentHint: false`; update → `idempotentHint: true`; delete → `destructiveHint: true, idempotentHint: true`.

### Groups, Tags & Folder Inference

`group` (single) and `tags` (free-form) help organize tools and feed `listMcpTools({ group, tags })` filters. `group` is **auto-inferred from the parent folder** — `server/mcp/tools/admin/delete-user.ts` → `group: 'admin'`. Explicit `group` wins.

```typescript
export default defineMcpTool({
  group: 'admin',
  tags: ['destructive', 'user-management'],
  description: 'Delete a user account',
  // ...
})
```

### Caching

```typescript
export default defineMcpTool({
  cache: '5m',  // also accepts `Number` of ms or full Nitro cache options
  description: 'Fetch weather (cached)',
  inputSchema: { city: z.string() },
  handler: async ({ city }) => $fetch(`/api/weather?city=${city}`),
})
```

### Conditional Visibility (`enabled`)

Hide a tool per request — runs **after** middleware, so `event.context` is populated:

```typescript
export default defineMcpTool({
  enabled: event => Boolean(event.context.user),
  description: 'List the current user’s todos',
  handler: async () => listTodos(useEvent().context.user.id),
})
```

See [tool examples →](./references/tools.md).

---

## Create Resources

Resources expose **read-only data** addressable by URI. Auto-discovered from `server/mcp/resources/`.

### File Shorthand (zero handler)

```typescript [server/mcp/resources/readme.ts]
export default defineMcpResource({
  description: 'Project README file',
  file: 'README.md', // URI, MIME type, and handler auto-generated
})
```

### Standard Resource (custom handler)

```typescript [server/mcp/resources/config.ts]
export default defineMcpResource({
  description: 'Application config',
  uri: 'config:///app',
  metadata: { mimeType: 'application/json' },
  handler: async (uri) => ({
    contents: [{
      uri: uri.toString(),
      mimeType: 'application/json',
      text: JSON.stringify({ env: process.env.NODE_ENV }, null, 2),
    }],
  }),
})
```

### Template Resource (URI variables)

Pass a `ResourceTemplate` from the SDK as `uri`:

```typescript [server/mcp/resources/user.ts]
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'

export default defineMcpResource({
  description: 'Fetch a user by ID',
  uri: new ResourceTemplate('user:///{id}', { list: undefined }),
  handler: async (uri, { id }) => {
    const user = await getUser(String(id))
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'application/json',
        text: JSON.stringify(user, null, 2),
      }],
    }
  },
})
```

### Metadata & Annotations

Use the top-level `metadata` field for MIME type and `annotations` (audience, priority, lastModified):

```typescript
export default defineMcpResource({
  description: 'Project README',
  file: 'README.md',
  metadata: {
    mimeType: 'text/markdown',
    annotations: {
      audience: ['user', 'assistant'],
      priority: 0.8,
      lastModified: new Date().toISOString(),
    },
  },
})
```

See [resource examples →](./references/resources.md).

---

## Create Prompts

Prompts are reusable message templates. Auto-discovered from `server/mcp/prompts/`.

### Simple String Prompt

```typescript [server/mcp/prompts/code-review.ts]
export default defineMcpPrompt({
  description: 'Code-review assistant',
  handler: async () => 'You are a senior reviewer. Be concise and actionable.',
})
```

The string is wrapped into a single user message. Set `role: 'assistant'` to wrap as an assistant message instead.

### Parameterized Prompt

```typescript [server/mcp/prompts/review.ts]
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate a focused code review',
  inputSchema: {
    language: z.string().describe('Programming language'),
    focus: z.enum(['performance', 'security', 'maintainability']).describe('Review focus'),
  },
  handler: async ({ language, focus }) =>
    `Review my ${language} code. Focus on ${focus}.`,
})
```

### Argument Autocomplete with `completable()`

Surface dynamic suggestions in clients that support `prompts/complete`:

```typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Open an issue for a project',
  inputSchema: {
    project: completable(z.string(), async (value) => {
      const projects = await listProjects()
      return projects.filter(p => p.startsWith(value)).slice(0, 5)
    }).describe('Project name'),
  },
  handler: async ({ project }) => `Open an issue for ${project}.`,
})
```

### Full `GetPromptResult` (multi-message)

```typescript
export default defineMcpPrompt({
  description: 'Structured debugging session',
  inputSchema: { issue: z.string(), env: z.enum(['dev', 'staging', 'prod']) },
  handler: async ({ issue, env }) => ({
    messages: [
      { role: 'user', content: { type: 'text', text: `Debug in ${env}:\n${issue}` } },
      { role: 'assistant', content: { type: 'text', text: 'Let me analyze step by step:' } },
    ],
  }),
})
```

::callout{icon="i-lucide-info" color="info"}
The MCP spec only allows `user` and `assistant` roles. Put system instructions inside the user message text.
::

See [prompt examples →](./references/prompts.md).

---

## Multi-Handler Organization

By default everything under `server/mcp/{tools,resources,prompts}/` is exposed at `/mcp`. To split into multiple endpoints with different middleware, use the **folder convention**:

```
server/mcp/
├── tools/                       # → /mcp (default handler)
└── handlers/
    ├── admin/
    │   ├── index.ts             # defineMcpHandler({ middleware: requireAdmin })
    │   ├── tools/               # → /mcp/admin (auto)
    │   └── prompts/
    └── public/
        ├── index.ts
        └── tools/               # → /mcp/public (auto)
```

```typescript [server/mcp/handlers/admin/index.ts]
export default defineMcpHandler({
  description: 'Admin tools — destructive operations gated by Bearer auth.',
  middleware: async (event) => {
    const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
    const user = apiKey ? await verifyAdmin(apiKey) : null
    if (user) event.context.user = user
    // No throw — let `enabled` guards on individual tools hide them when there's no user
  },
  // tools / resources / prompts omitted → folder convention auto-attaches them
})
```

`mcp.defaultHandlerStrategy` controls what `/mcp` exposes when named handlers exist:

- `'orphans'` (default) — only definitions **not** attached to a named handler.
- `'all'` — every discovered definition (the kitchen-sink route).

Cross-cutting filters use the function form:

```typescript
import { defineMcpHandler, getMcpTools } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  // Every tool tagged 'searchable', regardless of folder
  tools: event => getMcpTools({ event, tags: ['searchable'] }),
})
```

See [handlers reference →](./references/handlers.md).

---

## Middleware

Middleware lives on `defineMcpHandler` (no separate `defineMcpMiddleware` exists). It runs before/after the MCP request, can populate `event.context`, and supports auto-`next()`:

```typescript [server/mcp/index.ts]
// Override the default `/mcp` handler with custom middleware
export default defineMcpHandler({
  middleware: async (event) => {
    // Soft auth: set context on success, never throw 401 from middleware
    // (throwing 401 triggers OAuth discovery in MCP clients)
    const apiKey = getHeader(event, 'authorization')?.replace('Bearer ', '')
    if (apiKey) {
      const user = await verifyApiKey(apiKey).catch(() => null)
      if (user) event.context.user = user
    }
  },
})
```

::callout{icon="i-lucide-triangle-alert" color="warning"}
**Don't `throw createError({ statusCode: 401 })`** from middleware — most clients interpret a 401 on the MCP route as "this server requires OAuth" and stop the regular flow. Either return `403` for hard rejections, or keep auth soft and let per-tool `enabled` guards hide what the user can't access.
::

### Logging Middleware (with `next()` for timing)

```typescript
import { extractToolNames } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpHandler({
  middleware: async (event, next) => {
    const start = Date.now()
    const response = await next()
    const tools = await extractToolNames(event)
    console.log(`[mcp] ${tools.join(',') || 'rpc'} took ${Date.now() - start}ms`)
    return response
  },
})
```

For structured wide events on every MCP request, use [`useMcpLogger()`](#observability) instead of `console.log` — it tags `mcp.tool`, `mcp.session_id`, `user.id`, etc. automatically.

See [middleware patterns →](./references/middleware.md).

---

## Nitro Runtime Hooks

Two per-request Nitro hooks fire during the MCP request lifecycle. Subscribe from a `server/plugins/*.ts` plugin to mutate the resolved config or reach the SDK `McpServer` instance from anywhere — no need to own a `defineMcpHandler`. Listeners that throw are logged and the request continues.

```
defineMcpHandler middleware → mcp:config:resolved → createMcpServer → mcp:server:created → transport
```

### `mcp:config:resolved` — mutate tools/resources/prompts per request

Fires after dynamic resolvers and `enabled(event)` guards, before the per-request `McpServer` is built. Mutate `ctx.config` in place.

```typescript [server/plugins/mcp-filter.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:config:resolved', ({ config, event }) => {
    if (!event.context.user) {
      config.tools = config.tools.filter(t => !t.tags?.includes('admin'))
    }
  })
})
```

### `mcp:server:created` — reach the SDK server

Fires after every tool/resource/prompt has been registered, before the server is connected to the transport. Use the SDK API to register definitions late or call `getSdkServer(server)` for low-level handlers.

```typescript [server/plugins/mcp-whoami.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:server:created', ({ server, event }) => {
    server.registerTool(
      'whoami',
      { description: 'Return the current user id' },
      async () => ({
        content: [{ type: 'text', text: String(event.context.userId ?? 'anonymous') }],
      }),
    )
  })
})
```

See the [hooks reference →](https://mcp-toolkit.nuxt.dev/advanced/hooks).

---

## Sessions

Stateful MCP — server assigns an `Mcp-Session-Id` and remembers data across tool calls in the same session.

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: {
    sessions: true, // or { maxDuration: 30 * 60_000, maxSessions: 1000 }
  },
})
```

```typescript [server/mcp/tools/remember.ts]
import { z } from 'zod'

export default defineMcpTool({
  description: 'Remember a fact for this session',
  inputSchema: { key: z.string(), value: z.string() },
  handler: async ({ key, value }) => {
    const session = useMcpSession<{ facts: Record<string, string> }>()
    const facts = (await session.get('facts')) ?? {}
    facts[key] = value
    await session.set('facts', facts)
    return `Remembered ${key}.`
  },
})
```

Sessions enable SSE streaming, server-to-client notifications, and elicitation. See [sessions reference →](./references/sessions.md).

---

## Elicitation

Ask the connected client for structured input mid-request, or send the user to a URL (MCP spec 2025-11-25).

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Create a release after asking for the channel',
  inputSchema: { name: z.string() },
  handler: async ({ name }) => {
    const elicit = useMcpElicitation()
    if (!elicit.supports('form')) {
      return `Pass --channel via your client; "${name}" needs a release channel.`
    }

    const result = await elicit.form({
      message: `Pick a channel for "${name}"`,
      schema: {
        channel: z.enum(['stable', 'beta']).describe('Release channel'),
        notify: z.boolean().default(true),
      },
    })
    if (result.action !== 'accept') return `Cancelled (${result.action}).`
    return `Released ${name} on ${result.content.channel}.`
  },
})
```

- **Form mode** — Zod raw shape, validated and typed. Schema must be a flat object of primitives, enums, or string-enum arrays.
- **URL mode** — `elicit.url({ message, url })`, opt-in per spec; gate with `elicit.supports('url')`.
- **Confirm** — `await elicit.confirm('Continue?')` returns `boolean`.
- **Errors** — catch `McpElicitationError` (`code: 'unsupported' | 'invalid-schema' | 'invalid-response'`) to fall back gracefully.

Requires `nitro.experimental.asyncContext: true` and a client that declared the `elicitation` capability.

See [elicitation docs →](https://mcp-toolkit.nuxt.dev/advanced/elicitation).

---

## Observability — `useMcpLogger()`

Split-channel logger. `notify` goes to the connected client; `set` / `event` / `evlog` feed the request's [evlog](https://evlog.dev) wide event when observability is on.

```typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Charge a payment method',
  inputSchema: { userId: z.string(), amount: z.number().int().positive() },
  annotations: { destructiveHint: true, idempotentHint: false },
  handler: async ({ userId, amount }) => {
    const log = useMcpLogger('billing')
    log.set({ billing: { amount } })
    await log.notify.info({ msg: 'starting charge', amount })

    try {
      const receipt = await chargeCard(userId, amount)
      log.event('charge_completed', { receiptId: receipt.id })
      return `Charged ${amount}. Receipt: ${receipt.id}`
    }
    catch (err) {
      log.evlog.error('charge failed', err as Error)
      throw err
    }
  },
})
```

- **Client channel** (`log.notify`): `notify(level, data, logger?)` + `.debug` / `.info` / `.warning` / `.error`. Always resolves, never throws.
- **Server channel**: `set(fields)` / `event(name, fields?)` / `setUser({ id, email, name })` / `setSession({ id })` / `evlog`. Throws `McpObservabilityNotEnabledError` when off.
- Wide events are auto-tagged: `mcp.method`, `mcp.tool`, `mcp.session_id`, `mcp.request_id`, `service: '<env.service>/mcp'`. `user.*` / `session.*` flow through automatically when middleware sets `event.context.user` / `event.context.session`.

### Setup

::code-group
```bash [pnpm]
pnpm add evlog
```
```bash [npm]
npm install evlog
```
::

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['evlog/nuxt', '@nuxtjs/mcp-toolkit'],
  evlog: { env: { service: 'my-app' } },
})
```

`mcp.logging`: omit (auto-detect), `true` (assert `evlog/nuxt` is registered), `false` (opt out).

### Drains

Ship every MCP wide event to **Axiom, Sentry, OTLP, HyperDX, Datadog, Better Stack, or PostHog** with one Nitro plugin:

```typescript [server/plugins/evlog-axiom.ts]
import { createAxiomDrain } from 'evlog/adapters/axiom'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('evlog:drain', createAxiomDrain())
})
```

See [logging docs →](https://mcp-toolkit.nuxt.dev/advanced/logging) and [evlog.dev →](https://evlog.dev).

---

## MCP Apps (interactive UI widgets)

Author Vue Single-File Components in `app/mcp/` — they ship to MCP-Apps-compatible hosts (ChatGPT, Cursor) as interactive widgets backed by your MCP tool handler.

```vue [app/mcp/palette.vue]
<script setup lang="ts">
import { z } from 'zod'

defineMcpApp({
  description: 'Pick a colour and preview a palette.',
  inputSchema: { base: z.string().describe('Hex colour, e.g. #2563eb') },
  handler: async ({ base }) => ({
    structuredContent: await $fetch('/api/palette', { query: { base } }),
  }),
})

const { data, sendPrompt } = useMcpApp<{ swatches: { name: string, hex: string }[] }>()
</script>

<template>
  <div class="grid grid-cols-3 gap-2">
    <button
      v-for="s in data?.swatches"
      :key="s.hex"
      class="rounded-md p-3 text-white"
      :style="{ background: s.hex }"
      @click="sendPrompt(`Use ${s.name}`)"
    >
      {{ s.name }}
    </button>
  </div>
</template>
```

Each SFC becomes a tool, a UI resource at `ui://mcp-app/<name>`, and a single-file HTML bundle. The handler runs server-side; `structuredContent` is inlined into the HTML so the iframe boots **with full data on the first paint**.

`useMcpApp<T>()` exposes `data`, `loading`, `error`, `hostContext`, `callTool(name, params)`, `sendPrompt(prompt)`, and `openLink(url)`.

CSP is strict by default — opt extra origins in:

```typescript
defineMcpApp({
  csp: {
    resourceDomains: ['https://images.example.com'], // <img>, <style>, fonts
    connectDomains: ['https://api.example.com'], // fetch / XHR / WebSocket
  },
  // ...
})
```

See [MCP Apps reference →](./references/apps.md).

---

## Server Metadata

Identify the server in client UIs and steer the LLM with operational instructions:

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  mcp: {
    name: 'Todos MCP',
    description: 'Read and update todos for the current user.', // shown in client UIs
    instructions: 'Always call list-todos before create-todo. Group results by status.', // injected into the LLM system prompt
    icons: [
      { src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] },
    ],
  },
})
```

Override per-handler when an endpoint needs a different identity (e.g. `/mcp/admin` with its own description and icons).

---

## Listing Definitions (read your catalog)

Use `listMcp*` to expose summaries (catalog endpoints) and `getMcp*` for raw definitions to feed into a handler:

```typescript [server/routes/.well-known/mcp/server-card.json.get.ts]
import { listMcpDefinitions } from '@nuxtjs/mcp-toolkit/server'

export default defineEventHandler(async (event) => {
  const { tools, resources, prompts } = await listMcpDefinitions({ event })
  return {
    name: 'My MCP Server',
    tools: tools.map(t => ({ name: t.name, description: t.description })),
    resources: resources.map(r => ({ name: r.name, uri: r.uri })),
    prompts: prompts.map(p => ({ name: p.name, description: p.description })),
  }
})
```

Filters: `event` (apply `enabled` guards), `group`, `tags`, `handler`, `orphansOnly`. Pass `event` to match exactly what the request would see.

---

## Code Mode (experimental)

Wrap every tool exposed by a handler into a single `code` tool. The LLM writes JavaScript that calls tools via `codemode.*`, executed in a secure V8 isolate via [`secure-exec`](https://www.npmjs.com/package/secure-exec).

```typescript [server/mcp/handlers/codemode/index.ts]
export default defineMcpHandler({
  experimental_codeMode: {
    progressive: true,
    memoryLimit: 128,        // MB
    cpuTimeLimitMs: 5000,
    maxToolCalls: 20,
  },
})
```

```bash
npm install secure-exec
```

Useful for letting the LLM orchestrate many tool calls in one round-trip. Not supported on Cloudflare Workers (returns a clear runtime error).

See [Code Mode docs →](https://mcp-toolkit.nuxt.dev/advanced/code-mode).

---

## Review & Best Practices

When reviewing or modernizing `server/mcp/**`, walk this checklist:

### Tools

✅ Direct returns (`string`, object, array) instead of full `CallToolResult`
✅ `throw createError({ statusCode, message })` for failures (caught and returned as `isError`)
✅ `.describe()` on every Zod field
✅ Honest `annotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
✅ `inputExamples` for non-trivial schemas
✅ `enabled: event => Boolean(event.context.user)` to hide tools per request
✅ `cache: '5m'` (or full Nitro options) for expensive idempotent ops
✅ `nitro.experimental.asyncContext: true` when calling `useEvent()` / `useMcpServer()` / `useMcpSession()` / `useMcpLogger()` / `useMcpElicitation()`

❌ `textResult` / `jsonResult` / `errorResult` (deprecated — use direct returns or throw)
❌ `defineMcpMiddleware` (does not exist — middleware is a field on `defineMcpHandler`)
❌ Throwing `401` from middleware (triggers OAuth discovery in clients — return `403`, or use soft auth + `enabled` guards)
❌ Generic descriptions, missing `await`, unvalidated input, exposed secrets

### Resources

✅ `mimeType` under `metadata` (not at top level)
✅ `file: 'README.md'` shorthand for static files (URI, MIME and handler auto-generated)
✅ `ResourceTemplate` for parameterized URIs
✅ `metadata.annotations` for `audience` / `priority` / `lastModified`

❌ Returning huge payloads — paginate via templates
❌ Skipping the MIME type — clients use it to render correctly

### Prompts

✅ Plain `string` returns when one user message is enough (uses `role` field, default `'user'`)
✅ `completable(z.string(), async value => suggestions)` for argument autocomplete
✅ Single, focused purpose per prompt

❌ Mixing system instructions outside the `user` message (the spec rejects `system` role)

### Handlers

✅ Folder convention (`server/mcp/handlers/<name>/`) over manual `tools: [...]` arrays
✅ One responsibility per handler (admin / public / apps), pick the right `defaultHandlerStrategy`
✅ Per-handler `description` / `instructions` / `icons` when an endpoint has its own identity

---

## Troubleshooting

### Tool / Resource / Prompt not discovered

1. File is under `server/mcp/{tools,resources,prompts}/` (or under a `handlers/<name>/` subfolder)?
2. `export default` (not a named export)?
3. Restart dev server and run `pnpm nuxt prepare`.

### Auto-imports not working

1. `'@nuxtjs/mcp-toolkit'` listed in `modules` in `nuxt.config.ts`?
2. Run `pnpm dev:prepare` (or `pnpm nuxt prepare`) to regenerate type stubs.
3. Restart the TypeScript server in your IDE.
4. If you've set `mcp.autoImports: false`, import explicitly from `@nuxtjs/mcp-toolkit/server`.

### Endpoint not accessible

```bash
curl -X POST http://localhost:3000/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Should return a JSON-RPC response. If `404`, check `mcp.enabled !== false` and `mcp.route`.

### `useEvent()` / `useMcpServer()` / `useMcpSession()` throws "no async context"

Add `nitro.experimental.asyncContext: true` to `nuxt.config.ts`. These composables read the current event from Nitro's async-local storage, which only works when `asyncContext` is on (default since Nuxt 3.8+).

If your IDE / `vue-tsc` infers `Promise<…>` for one of these (a known auto-import quirk), `await` the call defensively — runtime works either way: `const mcp = await useMcpServer()`.

### Client triggers OAuth flow on every request

You're throwing `401` from middleware. Switch to **soft auth**: set `event.context.user` on success, return `403` for hard rejections, and gate per-tool with `enabled: event => Boolean(event.context.user)`.

### Origin checks rejecting browser clients

Set `mcp.security.allowedOrigins`:

```typescript
mcp: {
  security: {
    allowedOrigins: ['https://my-app.vercel.app'],
    // allowedOrigins: '*' // explicit opt-out — use with care
  },
}
```

See [troubleshooting reference →](./references/troubleshooting.md).

---

## Testing with Evals

Eval the right-tool-for-the-prompt selection with [Evalite](https://evalite.dev):

```bash
pnpm add -D evalite vitest @ai-sdk/mcp ai
```

```json [package.json]
{
  "scripts": {
    "eval": "evalite",
    "eval:ui": "evalite watch"
  }
}
```

```typescript [test/mcp.eval.ts]
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { generateText } from 'ai'
import { evalite } from 'evalite'
import { toolCallAccuracy } from 'evalite/scorers'

evalite('MCP Tool Selection', {
  data: async () => [
    {
      input: 'Calculate BMI for 70kg 1.75m',
      expected: [{ toolName: 'bmi-calculator', input: { weight: 70, height: 1.75 } }],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({
      transport: { type: 'http', url: 'http://localhost:3000/mcp' },
    })
    try {
      const result = await generateText({
        model: 'openai/gpt-4o',
        prompt: input,
        tools: await mcp.tools(),
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [
    ({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected }),
  ],
})
```

Run it:

```bash
pnpm dev          # in one terminal
pnpm eval         # in another, or `pnpm eval:ui` for the watcher UI
```

See [testing reference →](./references/testing.md).

---

## Quick Reference

### Configuration

```typescript [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'My Server',
    description: 'What this server does',
    instructions: 'How the LLM should use it',
    route: '/mcp',
    sessions: true,
    defaultHandlerStrategy: 'orphans', // or 'all'
    security: { allowedOrigins: ['https://my-app.vercel.app'] },
    logging: true, // requires evlog/nuxt
  },
  nitro: { experimental: { asyncContext: true } },
})
```

### Server-Side API (auto-imported)

| Helper | Purpose |
| --- | --- |
| `defineMcpTool` / `defineMcpResource` / `defineMcpPrompt` | Declare a definition (auto-discovered). |
| `defineMcpHandler` | Custom handler with middleware / dynamic tools. |
| `defineMcpApp` (in `app/mcp/*.vue`) | Interactive Vue widget. |
| `imageResult` / `audioResult` | Wrap binary content in a tool response. |
| `completable` | Argument autocomplete on prompts. |
| `extractToolNames` | Parse tool names from the JSON-RPC body in middleware. |
| `useMcpServer()` | Mid-session register/unregister tools. |
| `useMcpSession<T>()` | Per-session storage (sessions must be enabled). |
| `useMcpLogger(name?)` | Client notifications + server-side wide events. |
| `useMcpElicitation()` | Form / URL / confirm prompts to the client. |
| `useMcpApp<T>()` (in MCP App SFCs) | Reactive `data` + `callTool` / `sendPrompt` bridge. |
| `listMcpTools` / `listMcpResources` / `listMcpPrompts` / `listMcpDefinitions` | JSON-friendly summaries (catalog endpoints). |
| `getMcpTools` / `getMcpResources` / `getMcpPrompts` | Raw definitions (feed back into a handler). |
| `getSdkServer` | Reach the low-level SDK `Server` from an `McpServer` (advanced). |

### Nitro Hooks

| Hook | Fires |
| --- | --- |
| `mcp:config:resolved` | Per request, after dynamic resolvers — mutate `config.tools / resources / prompts / instructions / icons / name`. |
| `mcp:server:created` | Per request, after every definition is registered — call `server.registerTool(...)`, `getSdkServer(server).setRequestHandler(...)`, etc. |

### Debug

- **DevTools**: Shift+Alt+D → MCP tab (bundled MCP Inspector).
- **CLI Inspector**: `npx @modelcontextprotocol/inspector http://localhost:3000/mcp`
- **curl smoke test**: `curl -X POST … -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`

## Learn More

- [Documentation](https://mcp-toolkit.nuxt.dev)
- [Tools](https://mcp-toolkit.nuxt.dev/tools/overview) · [Resources](https://mcp-toolkit.nuxt.dev/resources/overview) · [Prompts](https://mcp-toolkit.nuxt.dev/prompts/overview)
- [Handlers](https://mcp-toolkit.nuxt.dev/handlers/overview) · [Apps](https://mcp-toolkit.nuxt.dev/apps/overview)
- [Sessions](https://mcp-toolkit.nuxt.dev/advanced/sessions) · [Logging](https://mcp-toolkit.nuxt.dev/advanced/logging) · [Elicitation](https://mcp-toolkit.nuxt.dev/advanced/elicitation) · [Hooks](https://mcp-toolkit.nuxt.dev/advanced/hooks)
- [MCP Specification](https://modelcontextprotocol.io)
