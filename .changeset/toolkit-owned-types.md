---
"nitro-mcp-toolkit": major
"@nuxtjs/mcp-toolkit": major
---

The public API no longer re-exports engine types under h3-mcp's names. Import the toolkit's names instead: `McpAuthOptions`, `McpAuthCredentials`, `McpAuthScheme`, `McpCacheHints`, `McpEra`, `McpExtensionPlugin`, `McpOriginOptions` and `McpHandlerSetup` replace `AuthOptions`, `AuthCredentials`, `AuthScheme`, `CacheHints`, `Era`, `ExtensionPlugin`, `OriginOptions` and `PluginOptions`. `McpRequestContext` types `event.context.mcp`, and `McpSessionOptions` and `McpLimitsOptions` type the `session` and `limits` options. MCP spec types such as `CallToolResult` and `Icon` are unchanged.

`McpHandlerOptions` now lists its options explicitly instead of accepting every h3-mcp handler option. The engine callbacks `onListen`, `onStream`, `onCancelled`, `onProgress`, `onLogLevelSet`, `onSubscribe` and `onUnsubscribe`, and the `cache`, `extensions`, `subscriptions` and `echoServerInfo` options, are no longer accepted. Use `handler.notify` to push list-changed and resource-updated events.
