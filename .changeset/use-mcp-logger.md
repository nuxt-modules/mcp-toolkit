---
"@nuxtjs/mcp-toolkit": minor
---

Add `useMcpLogger()` and first-class observability via [evlog](https://evlog.dev), shipped as an **optional peer dependency**.

The composable is split into two clearly-named channels so it's always obvious what reaches the user vs. your server logs:

```typescript
const log = useMcpLogger('billing')

// → MCP client (Inspector / Cursor / Claude — notifications/message). Always works.
await log.notify.info({ msg: 'starting charge', amount })

// → server-side wide event (dev terminal + drains). Requires `evlog` installed.
log.set({ user: { id: userId } })
log.event('charge_started', { amount })
```

- **Client channel** — `log.notify(level, data, logger?)` plus `notify.debug` / `notify.info` / `notify.warning` / `notify.error` shortcuts. Always resolves, never throws, and respects the client's `logging/setLevel` per session. The toolkit declares the `logging` server capability automatically. Works without `evlog`.
- **Server channel** — `log.set(fields)` accumulates context onto the request's evlog wide event; `log.event(name, fields?)` captures a discrete event; `log.evlog` exposes the full [`RequestLogger`](https://evlog.dev/docs/api/request-logger) (`fork`, `error`, `getContext`, …). Throws `McpObservabilityNotEnabledError` when observability is off.

### Opt-in observability

`evlog` is an **optional peer dependency** — install it to unlock wide events:

```bash
pnpm add evlog
```

`mcp.logging` modes:

| Value | Behavior |
|---|---|
| omitted (default) | Auto-detect: on if `evlog` is installed, off otherwise. |
| `true` or object | Force on. Build throws with install instructions if `evlog` is missing. |
| `false` | Force off. `notify` keeps working; `set` / `event` / `evlog` throw `McpObservabilityNotEnabledError`. |

### Native MCP wide-event tagging

When observability is active, every MCP request is wrapped in an evlog wide event natively tagged with the JSON-RPC payload — no user code required:

| Field | Description |
|---|---|
| `mcp.transport` | `streamable-http` / `cloudflare-do` |
| `mcp.route` | The configured MCP endpoint path |
| `mcp.session_id` | From the `mcp-session-id` header |
| `mcp.method` | `tools/call`, `tools/list`, `initialize`, … |
| `mcp.request_id` | The JSON-RPC id |
| `mcp.tool` / `mcp.resource` / `mcp.prompt` | Filled per `tools/call` / `resources/read` / `prompts/get` |

Batched JSON-RPC payloads expose plural arrays (`mcp.methods`, `mcp.tools`, …).

### Ship to your observability stack

Once `evlog` is installed, every MCP wide event can be forwarded to **Axiom, Sentry, OTLP, HyperDX, Datadog, Better Stack, or PostHog** with a single Nitro plugin — no MCP-specific glue, just the standard `evlog:drain` hook:

```typescript
// server/plugins/evlog-axiom.ts
import { createAxiomDrain } from 'evlog/adapters/axiom'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('evlog:drain', createAxiomDrain())
})
```

Register multiple drains in parallel, or write a custom one with `(ctx) => Promise<void>`. See [evlog.dev](https://evlog.dev) for the full list.

### Compatibility

When wired in, the integration plays nicely with `@nuxthub/core` and other modules that pull in CLI dependencies (e.g. `drizzle-kit`) — we no longer force `noExternals: true` globally; instead we inline only `evlog` and `evlog/nitro`.
