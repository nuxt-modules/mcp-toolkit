export default defineNuxtConfig({
  extends: ['docus'],

  modules: ['@hrcd/mcp', 'motion-v/nuxt'],

  css: ['~/assets/css/main.css'],

  // @ts-expect-error - site is a valid Docus property but not typed in NuxtConfig
  site: {
    name: 'Nuxt MCP Module',
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
    domain: 'https://nuxt-mcp-module.vercel.app',
    title: 'Nuxt MCP module',
    description: 'Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.',
    full: {
      title: 'Nuxt MCP module',
      description: 'Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.',
    },
  },

  mcp: {
    name: 'Nuxt MCP Module',
  },
})
