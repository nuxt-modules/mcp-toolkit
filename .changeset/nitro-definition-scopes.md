---
'nitro-mcp-toolkit': minor
---

`defineMcpTool`, `defineMcpResource` and `defineMcpPrompt` take `scopes`. A call is refused unless the verified access token carries every scope listed, read from `scope` (space-delimited) or `scp` (string or array). A refusal is a JSON-RPC `-32003` naming the missing scopes — under HTTP 403 on the modern revision, in the `200` stream a legacy request gets for every error — and it fails closed: scopes on an endpoint with no OAuth refuse every call.

```ts
export default defineMcpTool({
  scopes: ['todos:write'],
  inputSchema: z.object({ id: z.string() }),
  handler: ({ id }) => remove(id),
})
```

A scoped definition is still listed, with its scopes in `_meta` and in `handler.definitions`; only the call is gated. Options resolve before a request is authenticated, so nothing that builds a listing has seen the token — use a separate endpoint when a tool's existence is itself sensitive.
