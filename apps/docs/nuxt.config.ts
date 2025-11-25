import yaml from '@rollup/plugin-yaml'

export default defineNuxtConfig({
  extends: ['docus'],

  modules: ['@nuxtjs/mcp-toolkit', 'motion-v/nuxt', 'nuxt-studio'],

  css: ['~/assets/css/main.css'],

  site: {
    name: 'Nuxt MCP Toolkit',
  },

  mdc: {
    highlight: {
      noApiRoute: false,
    },
  },

  vite: {
    plugins: [
      yaml(),
    ],
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
      rootDir: 'docs',
    },
  },
})
