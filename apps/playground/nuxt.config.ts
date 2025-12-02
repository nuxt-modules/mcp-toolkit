export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit', '@nuxt/ui', '@nuxthub/core'],

  $development: {
    nitro: {
      storage: {
        auth: {
          driver: 'memory',
        },
      },
    },
  },

  $production: {
    nitro: {
      storage: {
        auth: {
          driver: 'redis',
          url: process.env.REDIS_URL,
        },
      },
    },
  },

  devtools: { enabled: true },

  css: ['~/assets/css/index.css'],

  runtimeConfig: {
    public: {
      auth: {
        redirectUserTo: '/app',
        redirectGuestTo: '/',
      },
    },
  },

  compatibilityDate: '2025-05-13',

  nitro: {
    experimental: {
      asyncContext: true,
    },
    routeRules: {
      '/app/**': {
        ssr: false,
      },
    },
  },

  hub: {
    db: 'postgresql',
  },

  mcp: {
    name: 'Playground MCP',
  },
})
