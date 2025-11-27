export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  devtools: { enabled: true },
  experimental: {
    asyncContext: true,
  },
  mcp: {
    name: 'Playground MCP',
  },
})
