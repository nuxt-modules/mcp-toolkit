import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule, 'nuxt-llms'],
  mcp: {
    name: 'Fixture MCP',
    llms: false,
  },
  // `llms` is owned by nuxt-llms, whose types aren't generated for this package
  ...({
    llms: {
      domain: 'https://fixture.test',
      title: 'Fixture',
    },
  } as Record<string, unknown>),
})
