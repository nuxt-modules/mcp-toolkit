export default defineNuxtConfig({
  modules: ['evlog/nuxt', '@nuxtjs/mcp-toolkit', '@nuxt/ui', '@nuxthub/core'],

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
    mcpAdminToken: '',
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

  vite: {
    server: {
      // Allow tunneling the dev server through ngrok / cloudflared / localtunnel.
      // Strings allow exact hosts, `.tld` allows every subdomain on that TLD.
      allowedHosts: ['.ngrok-free.dev', '.ngrok.app', '.trycloudflare.com', '.loca.lt'],
    },
  },

  evlog: {
    env: { environment: 'development', service: 'playground' },
  },

  mcp: {
    servers: {
      default: {},
      admin: {},
    },
  },
})
