---
"nitro-mcp-toolkit": minor
---

Require resource-bound, expiring JWTs. Clerk now checks the MCP resource audience; WorkOS uses an AuthKit issuer (`issuer` or `WORKOS_AUTHKIT_ISSUER`) and Connect resource indicators instead of client-ID session tokens. Disabling generic JWT audience checks requires a custom `verify` callback that validates the resource.

Apply definition scopes to resource enumeration and completion callbacks and prompt completion. Unauthorized resource enumeration fails the listing before invoking that callback; static metadata remains visible.

Run plugin setup once and preserve the original event during unknown `X-MCP-Tools` authentication. Use `toolResult()` to return an explicit protocol envelope from a tool with `outputSchema`; plain objects remain schema data.

Accept the tested Nitro `3.0.260610-beta` peer in addition to stable `3.x`.
