import { defineNuxtConfig } from 'nuxt/config'

const config = {
  modules: ['@nuxtjs/mcp-toolkit'],

  compatibilityDate: '2025-05-13' as const,

  nitro: {
    preset: 'cloudflare-module',
  },

  mcp: {
    name: 'Cloudflare Test MCP',
  },
}

export default defineNuxtConfig(config)
