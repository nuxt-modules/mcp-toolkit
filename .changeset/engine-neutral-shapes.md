---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

Public types no longer follow the protocol engine's shapes. `McpRequestContext`, `McpAuthOptions`, `McpAuthCredentials`, `McpOriginOptions`, `McpSessionOptions` and `McpLimitsOptions` are now the toolkit's own interfaces, with the same fields as before, and `McpLogLevel` types the request's log level.

Definitions returned by `defineMcpTool`, `defineMcpResource` and `defineMcpPrompt` no longer have a `build` method. Spreading a definition still works.

`McpOAuth` no longer exposes `resource`, `resourceMetadataUrl`, `metadata` or `challengeScope`. Serve the metadata document with `oauth.metadataHandler(event)`, which now also accepts a Nitro 2 event, and read the challenge URL from `oauth.auth.resourceMetadataUrl`.

Extension plugins (`McpExtensionPlugin`, `defineMcpPlugins`, `<dir>/plugins.ts` and the `{ extensionPlugins }` argument) are now documented as experimental. They expose the engine's plugin contract and may change in any release.
