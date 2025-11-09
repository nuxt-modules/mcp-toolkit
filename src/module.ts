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
  redirectTo?: string
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
   * Custom path for MCP tools relative to server directory
   * @default 'mcp/tools'
   */
  toolsPath?: string
  /**
   * Custom path for MCP resources relative to server directory
   * @default 'mcp/resources'
   */
  resourcesPath?: string
  /**
   * Custom path for MCP prompts relative to server directory
   * @default 'mcp/prompts'
   */
  promptsPath?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-mcp',
    configKey: 'mcp',
  },
  defaults: {
    enabled: true,
    route: '/mcp',
    redirectTo: '/',
    name: '',
    version: '1.0.0',
    toolsPath: 'mcp/tools',
    resourcesPath: 'mcp/resources',
    promptsPath: 'mcp/prompts',
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.mcp = defu(
      nuxt.options.runtimeConfig.mcp,
      {
        enabled: options.enabled,
        route: options.route,
        redirectTo: options.redirectTo,
        name: options.name,
        version: options.version,
        toolsPath: options.toolsPath,
        resourcesPath: options.resourcesPath,
        promptsPath: options.promptsPath,
      },
    )

    if (!options.enabled) {
      log.info('MCP server is disabled')
      return
    }

    log.info(`MCP server enabled at route: ${options.route}`)

    await loadAllDefinitions({
      toolsPath: options.toolsPath ?? 'mcp/tools',
      resourcesPath: options.resourcesPath ?? 'mcp/resources',
      promptsPath: options.promptsPath ?? 'mcp/prompts',
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
      handler: resolver.resolve('runtime/server/mcp/handler.ts'),
    })
  },
})
