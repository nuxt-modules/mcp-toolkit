export default defineNuxtConfig({
  modules: ['../../../src/module'],
  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
})
