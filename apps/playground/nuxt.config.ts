export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  devtools: { enabled: true },
  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
  mcp: {
    name: 'Playground MCP',
  },
})
