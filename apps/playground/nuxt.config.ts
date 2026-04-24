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

  vite: {
    server: {
      // Allow tunneling the dev server through ngrok / cloudflared / localtunnel.
      // Strings allow exact hosts, `.tld` allows every subdomain on that TLD.
      allowedHosts: ['.ngrok-free.dev', '.ngrok.app', '.trycloudflare.com', '.loca.lt'],
    },
  },

  mcp: {
    name: 'Playground MCP',
    description: 'A demo MCP server showcasing authentication, todos, and user management.',
    instructions: 'Authenticate with an API key before calling protected tools. Use list-todos before create-todo to avoid duplicates.',
    sessions: true,
    logging: {
      env: { environment: 'development' },
    },
  },
})
