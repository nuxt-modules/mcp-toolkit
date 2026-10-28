---
"@nuxtjs/mcp-toolkit": major
---

Defer the built-in MCP Apps integration for the 1.0 beta. Remove `defineMcpApp`, `useMcpApp`, the `@nuxtjs/mcp-toolkit/app` entrypoint and App types, `mcp.apps`/`mcp.appsDir` options, and automatic Vue widget discovery and bundling.

Move server-side App handlers into regular `server/mcp/tools` definitions to keep exposing them as ordinary MCP tools. Tools, resources, prompts, custom metadata, and `InstallButton` remain available.
