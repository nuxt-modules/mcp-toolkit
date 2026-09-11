import type { NuxtConfig } from 'nuxt/schema'
import type { ModuleOptions as LlmsOptions } from 'nuxt-llms'
import { defineNuxtConfig } from 'nuxt/config'
import MyModule from '../../../src/module'

type FixtureConfig = NuxtConfig & {
  llms: Partial<LlmsOptions> & Pick<LlmsOptions, 'domain'>
}

const config: FixtureConfig = {
  modules: [MyModule, 'nuxt-llms'],
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
  mcp: {
    name: 'Fixture MCP',
    description: 'Fixture MCP server used in tests.',
    browserRedirect: 'https://docs.fixture.test/mcp',
  },
}

export default defineNuxtConfig(config)
