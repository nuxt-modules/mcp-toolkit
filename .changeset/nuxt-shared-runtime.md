---
"@nuxtjs/mcp-toolkit": major
"nitro-mcp-toolkit": patch
---

Move the Nuxt module onto the shared Nitro MCP runtime, requiring Nuxt 4.6 or later. Use complete Standard Schema definitions such as `z.object(...)`, explicit request events, and `mcp.servers` for independent endpoint directories and layer overrides. With an input schema, handlers receive `(args, event)`; without one they receive `event`.

Remove Code Mode, session storage helpers, SDK escape hatches, ambient logger/elicitation wrappers, registry queries, per-definition result caching, and duplicate transport providers. Keep application state and caching in application services; use shared engine helpers for continuations and notifications. Built-in MCP Apps remain deferred.

Nuxt middleware context and disconnect cancellation reach both discovered and manually composed endpoints. Modern and legacy clients use the shared protocol engine. Public MCP event types now use `h3/generic`, so Nuxt's H3 v1 alias does not change their web-standard request type.
