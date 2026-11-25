# Sessions — 1.0

## Sessions and state

`session: true` enables the shared engine's legacy MCP session handling. `session: { maxSessions: 1000 }` bounds concurrent sessions. Modern requests use request-scoped context and continuations instead of a server-assigned legacy session ID.

Use `event.context.mcp.sessionId` only when the negotiated protocol supplied one. Do not use a session ID as authorization or as a durable user identity.

The old `useMcpSession` and `invalidateMcpSession` helpers are removed. Keep durable user or tenant data in application storage keyed by verified identity. For modern multi-step interactions, use the engine's `defineRequestState` helper and input-required responses.

Continuation state is signed, not encrypted or automatically single-use. Bind it to verified identity and reauthorize when an interaction resumes.

## Elicitation and continuations

Use h3-mcp's exported input-request helpers: `mcpElicit`, `mcpElicitUrl`, `inputRequired`, `getInputResponses`, `getElicitedContent`, and `getMissingInputs`.

```ts
const requests = {
  confirm: mcpElicit({
    message: 'Continue?',
    requestedSchema: { type: 'object', properties: { confirm: { type: 'boolean' } }, required: ['confirm'] },
  }),
}
```

Inside a modern invocation, read `getElicitedContent(event, requests, 'confirm')`. If the answer is missing and `canRequestInput(event, requests.confirm)` is true, return `inputRequired(event, { inputRequests: getMissingInputs(event, requests) })`.

These input-required continuations require the modern protocol. Keep the required fields available as ordinary tool arguments, or return instructions to clients that cannot request input. Validate submitted content before acting on it. The old SDK-specific `useMcpElicitation()` helper is removed.
