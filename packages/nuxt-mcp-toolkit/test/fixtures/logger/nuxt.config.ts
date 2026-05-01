import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    'evlog/nuxt',
    MyModule,
  ],
  nitro: {
    experimental: {
      asyncContext: true,
    },
  },
  ...({
    evlog: {
      silent: true,
      env: { service: 'logger-fixture' },
    },
  } as Record<string, unknown>),
  mcp: {
    sessions: true,
  },
})
