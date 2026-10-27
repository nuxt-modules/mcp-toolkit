export default defineNuxtConfig({
  extends: ['docus'],

  modules: [
    '@nuxtjs/mcp-toolkit',
    'motion-v/nuxt',
    'nuxt-studio',
    '@vercel/analytics',
    '@vercel/speed-insights',
  ],

  css: ['~/assets/css/main.css'],

  site: {
    name: 'Nuxt MCP Toolkit',
  },

  mdc: {
    highlight: {
      noApiRoute: false,
    },
  },

  routeRules: {
    // Legacy "core-concepts" HTML paths
    '/core-concepts/configuration': { redirect: { to: '/getting-started/configuration', statusCode: 301 } },
    '/core-concepts': { redirect: { to: '/tools/overview', statusCode: 301 } },
    '/core-concepts/tools': { redirect: { to: '/tools/overview', statusCode: 301 } },
    '/core-concepts/resources': { redirect: { to: '/resources/overview', statusCode: 301 } },
    '/core-concepts/prompts': { redirect: { to: '/prompts/overview', statusCode: 301 } },
    '/core-concepts/handlers': { redirect: { to: '/handlers/overview', statusCode: 301 } },
    '/core-concepts/apps': { redirect: { to: '/getting-started/beta-migration', statusCode: 301 } },
    // Section roots (no `0.overview` in Examples) → sensible landing page
    '/getting-started': { redirect: { to: '/getting-started/introduction', statusCode: 301 } },
    '/examples': { redirect: { to: '/examples/common-patterns', statusCode: 301 } },
    '/advanced': { redirect: { to: '/advanced/custom-paths', statusCode: 301 } },
    '/tools': { redirect: { to: '/tools/overview', statusCode: 301 } },
    '/resources': { redirect: { to: '/resources/overview', statusCode: 301 } },
    '/prompts': { redirect: { to: '/prompts/overview', statusCode: 301 } },
    '/handlers': { redirect: { to: '/handlers/overview', statusCode: 301 } },
    '/apps': { redirect: { to: '/getting-started/beta-migration', statusCode: 301 } },
    '/apps/**': { redirect: { to: '/getting-started/beta-migration', statusCode: 301 } },
    '/advanced/mcp-apps-internals': { redirect: { to: '/getting-started/beta-migration', statusCode: 301 } },
    // Legacy "core-concepts" raw markdown (e.g. LLM / IDE deep links)
    '/raw/core-concepts/configuration.md': { redirect: { to: '/raw/getting-started/configuration.md', statusCode: 301 } },
    '/raw/core-concepts/tools.md': { redirect: { to: '/raw/tools/overview.md', statusCode: 301 } },
    '/raw/core-concepts/resources.md': { redirect: { to: '/raw/resources/overview.md', statusCode: 301 } },
    '/raw/core-concepts/prompts.md': { redirect: { to: '/raw/prompts/overview.md', statusCode: 301 } },
    '/raw/core-concepts/handlers.md': { redirect: { to: '/raw/handlers/overview.md', statusCode: 301 } },
    '/raw/core-concepts/apps.md': { redirect: { to: '/raw/getting-started/beta-migration.md', statusCode: 301 } },
    '/raw/apps/**': { redirect: { to: '/raw/getting-started/beta-migration.md', statusCode: 301 } },
    '/raw/advanced/mcp-apps-internals.md': { redirect: { to: '/raw/getting-started/beta-migration.md', statusCode: 301 } },
  },

  experimental: {
    asyncContext: true,
  },

  nitro: {
    externals: {
      // Vercel serverless bundles externalize unhead but fail to trace dist/server.mjs.
      // Docus needs `ai` v7 and nuxt-studio needs v6; only one can be hoisted as an external, so bundle each.
      inline: ['minimark', 'unhead', '@unhead/vue', '@unhead/dom', '@unhead/schema', 'ai/', '@ai-sdk/'],
    },
  },

  agentDiscovery: {
    discovery: {
      mcpServerCard: false,
      links: [
        { href: '/.well-known/mcp/server-card.json', rel: 'service-desc', type: 'application/json', anchor: '/mcp', title: 'MCP server card' },
        { href: '/mcp', rel: 'service', title: 'MCP endpoint', header: false },
      ],
    },
  },

  icon: {
    customCollections: [
      {
        prefix: 'custom',
        dir: './app/assets/icons',
      },
    ],
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
    provider: 'iconify',
  },

  llms: {
    domain: 'https://mcp-toolkit.nuxt.dev',
    title: 'Nuxt MCP Toolkit',
    description: 'Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.',
    full: {
      title: 'Nuxt MCP Toolkit',
      description: 'Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.',
    },
  },

  mcp: {
    name: 'Nuxt MCP Toolkit',
  },

  studio: {
    route: '/admin',
    repository: {
      provider: 'github',
      owner: 'nuxt-modules',
      repo: 'mcp-toolkit',
      branch: 'main',
      rootDir: 'apps/docs',
    },
    development: {
      sync: true,
    },
  },
})
