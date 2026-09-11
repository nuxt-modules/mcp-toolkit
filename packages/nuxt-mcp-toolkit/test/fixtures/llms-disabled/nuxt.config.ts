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
  },
  mcp: {
    name: 'Fixture MCP',
    llms: false,
  },
}

export default defineNuxtConfig(config)
