import { defineNuxtConfig } from 'nuxt/config'

const config = {
  modules: ['../../../src/module'],
  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
}

export default defineNuxtConfig(config)
