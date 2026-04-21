import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    MyModule,
  ],
  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
  mcp: {
    sessions: true,
  },
})
