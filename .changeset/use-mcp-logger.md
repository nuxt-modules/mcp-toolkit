---
"@nuxtjs/mcp-toolkit": minor
---

Add `useMcpLogger()` and first-class observability via [evlog](https://evlog.dev), shipped as a direct dependency.

The composable is split into two clearly-named channels so it's always obvious what reaches the user vs. your server logs:

```typescript
const log = useMcpLogger('billing')

// → MCP client (Inspector / Cursor / Claude — notifications/message)
await log.notify.info({ msg: 'starting charge', amount })

// → server-side wide event (dev terminal + drains)
log.set({ user: { id: userId } })
log.event('charge_started', { amount })
```

- **Client channel** — `log.notify(level, data, logger?)` plus `notify.debug` / `notify.info` / `notify.warning` / `notify.error` shortcuts. Always resolves, never throws, and respects the client's `logging/setLevel` per session. The toolkit declares the `logging` server capability automatically.
- **Server channel** — `log.set(fields)` accumulates context onto the request's evlog wide event; `log.event(name, fields?)` captures a discrete event; `log.evlog` exposes the full [`RequestLogger`](https://evlog.dev/docs/api/request-logger) (`fork`, `error`, `getContext`, …).

### Native MCP wide-event tagging

Every MCP request is wrapped in an evlog wide event natively tagged with the JSON-RPC payload — no user code required:

| Field | Description |
|---|---|
| `mcp.transport` | `streamable-http` / `cloudflare-do` |
| `mcp.route` | The configured MCP endpoint path |
| `mcp.session_id` | From the `mcp-session-id` header |
| `mcp.method` | `tools/call`, `tools/list`, `initialize`, … |
| `mcp.request_id` | The JSON-RPC id |
| `mcp.tool` / `mcp.resource` / `mcp.prompt` | Filled per `tools/call` / `resources/read` / `prompts/get` |

Batched JSON-RPC payloads expose plural arrays (`mcp.methods`, `mcp.tools`, …).

### evlog integration

`evlog` is now a direct dependency. The Nitro module is wired automatically. Configure drains (Axiom, OTLP, HyperDX, Sentry, Datadog, …), sampling, and redaction via `mcp.logging` in `nuxt.config.ts`, or set `mcp.logging: false` to opt out entirely (the `notify` channel keeps working).

The integration plays nicely with `@nuxthub/core` and other modules that pull in CLI dependencies (e.g. `drizzle-kit`) — we no longer force `noExternals: true` globally; instead we inline only `evlog` and `evlog/nitro`.
