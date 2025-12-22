export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],

  compatibilityDate: '2025-05-13',

  nitro: {
    preset: 'cloudflare-module',
  },

  mcp: {
    name: 'Cloudflare Test MCP',
  },
})
