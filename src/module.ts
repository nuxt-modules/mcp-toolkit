import { defineNuxtModule, addServerHandler, createResolver, addServerImports, logger } from '@nuxt/kit'
import { defu } from 'defu'
import { loadAllDefinitions } from './runtime/server/mcp/loaders'

const log = logger.withTag('nuxt-mcp')

export const { resolve } = createResolver(import.meta.url)

export interface ModuleOptions {
  /**
   * Enable or disable the MCP server
   * @default true
   */
  enabled?: boolean
  /**
   * The route path for the MCP server endpoint
   * @default '/mcp'
   */
  route?: string
  /**
   * URL to redirect to when a browser accesses the MCP endpoint
   * @default '/'
   */
  browserRedirect?: string
  /**
   * The name of the MCP server
   * @default Site name from site config or 'Docus Documentation'
   */
  name?: string
  /**
   * The version of the MCP server
   * @default '1.0.0'
   */
  version?: string
  /**
   * Base directory for MCP definitions relative to server directory
   * The module will look for tools, resources, and prompts in subdirectories
   * @default 'mcp'
   */
  dir?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-mcp',
    configKey: 'mcp',
  },
  defaults: {
    enabled: true,
    route: '/mcp',
    browserRedirect: '/',
    name: '',
    version: '1.0.0',
    dir: 'mcp',
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.mcp = defu(
      nuxt.options.runtimeConfig.mcp,
      {
        enabled: options.enabled,
        route: options.route,
        browserRedirect: options.browserRedirect,
        name: options.name,
        version: options.version,
        dir: options.dir,
      },
    )

    if (!options.enabled) {
      log.info('MCP server is disabled')
      return
    }

    log.info(`MCP server enabled at route: ${options.route}`)

    const mcpDir = options.dir ?? 'mcp'

    // Initialize paths arrays with default paths
    const paths = {
      tools: [`${mcpDir}/tools`],
      resources: [`${mcpDir}/resources`],
      prompts: [`${mcpDir}/prompts`],
    }

    // Load definitions after all modules are done to allow hook extensions
    nuxt.hook('modules:done', async () => {
      // Call hook to allow other modules to extend paths
      await nuxt.callHook('mcp:definitions:paths', paths)

      await loadAllDefinitions(paths)
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({
        path: resolver.resolve('runtime/server/types.server.d.ts'),
      })
    })

    nuxt.options.nitro.typescript ??= {}
    nuxt.options.nitro.typescript.tsConfig ??= {}
    nuxt.options.nitro.typescript.tsConfig.include ??= []
    nuxt.options.nitro.typescript.tsConfig.include.push(resolver.resolve('runtime/server/types.server.d.ts'))

    addServerImports([
      {
        name: 'defineMcpTool',
        from: resolver.resolve('runtime/server/mcp/definitions'),
      },
      {
        name: 'defineMcpResource',
        from: resolver.resolve('runtime/server/mcp/definitions'),
      },
      {
        name: 'defineMcpPrompt',
        from: resolver.resolve('runtime/server/mcp/definitions'),
      },
    ])

    addServerHandler({
      route: options.route,
      handler: resolver.resolve('runtime/server/mcp/handler'),
    })
  },
})
