export default defineMcpPrompt({
  description: 'Set up a Nuxt MCP server using the shared 1.0 engine',
  handler: () => `Inspect the installed Nuxt version and project structure, then read https://mcp-toolkit.nuxt.dev/getting-started/installation.
Install @nuxtjs/mcp-toolkit with a Standard Schema library, add the module to nuxt.config.ts, and write default exports under server/mcp/{tools,resources,prompts}.
Use complete schemas such as z.object(...), callbacks with request events, and explicit output schemas for structured data.
Configure independent endpoints with mcp.servers. Use verified identity and endpoint auth, preserve both protocol generations, and provide fallbacks for clients without optional capabilities.
Built-in MCP Apps are deferred for the beta. Verify discovery and invocation with real clients and a production build.`,
})
