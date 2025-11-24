import yaml from '@rollup/plugin-yaml'

export default defineNuxtConfig({
  extends: ['docus'],

  modules: ['nuxt-mcp-toolkit', 'motion-v/nuxt', 'nuxt-studio'],

  css: ['~/assets/css/main.css'],

  // @ts-expect-error - site is a valid Docus property but not typed in NuxtConfig
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
    domain: 'https://nuxt-mcp-toolkit.vercel.app',
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
      owner: 'HugoRCD',
      repo: 'nuxt-mcp-toolkit',
      branch: 'main',
      rootDir: 'docs',
    },
  },
})
