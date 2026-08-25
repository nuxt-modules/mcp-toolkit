import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule, 'nuxt-llms'],
  mcp: {
    name: 'Fixture MCP',
    description: 'Fixture MCP server used in tests.',
    browserRedirect: '/docs/mcp',
  },
  // `llms` is owned by nuxt-llms, whose types aren't generated for this package
  ...({
    llms: {
      domain: 'https://fixture.test',
      title: 'Fixture',
      description: 'Fixture site.',
      sections: [
        {
          title: 'Docs',
          links: [{ title: 'Home', href: 'https://fixture.test/' }],
        },
      ],
    },
  } as Record<string, unknown>),
})
