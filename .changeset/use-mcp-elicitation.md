---
"@nuxtjs/mcp-toolkit": minor
---

Add `useMcpElicitation()` for requesting structured input from the connected client (MCP spec 2025-11-25).

```typescript
const elicit = useMcpElicitation()

const result = await elicit.form({
  message: 'Pick a release channel',
  schema: { channel: z.enum(['stable', 'beta']) },
})
if (result.action !== 'accept') return 'Cancelled.'
```

- **Form mode** — pass a Zod raw shape; the response is validated and fully typed.
- **URL mode** — `elicit.url({ message, url })` redirects the user to a hosted page (opt-in per the spec).
- **Confirm** — `elicit.confirm(message)` returns a `boolean`.
- **Capability check** — `elicit.supports('form' | 'url')` follows the spec's backwards compatibility rule (an empty `elicitation: {}` capability defaults to form support; once `url` is declared explicitly, `form` must be too).
- **Typed errors** — `McpElicitationError` with `code: 'unsupported' | 'invalid-schema' | 'invalid-response'` so callers can fall back gracefully when the client doesn't support the prompt.
- Underlying validation: Zod → JSON Schema (per the MCP spec, the schema must be a flat object of primitives, enums, or string-enum arrays — nested objects are rejected up front).

The composable is auto-imported alongside the existing helpers and re-exported from `@nuxtjs/mcp-toolkit/server`. The toolkit also re-exports `useMcpServer()` and `useMcpSession()` from the same entry point.

Also bumps the DevTools MCP Inspector launch budget to 60s with a fast-path that resolves as soon as the inspector emits its ready URL with the captured `MCP_PROXY_AUTH_TOKEN`, so the Inspector tab no longer times out on a cold `npx` install when testing elicitation.
