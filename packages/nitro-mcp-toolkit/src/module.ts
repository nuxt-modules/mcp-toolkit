import type { Nitro } from 'nitropack'
import { loadAllDefinitions, type LoaderPaths } from './loaders'
import { defaultMcpConfig, type McpConfig } from './config'
import type { McpNitroModuleOptions, NitroModule } from './types'

export type { McpNitroModuleOptions, NitroModule }

export * from './config'
export * from './types'
export { loadAllDefinitions, type LoaderPaths } from './loaders'

export {
  defineMcpTool,
  defineMcpResource,
  defineMcpPrompt,
  defineMcpHandler,
  textResult,
  jsonResult,
  errorResult,
  imageResult,
} from './definitions'

const ROUTES = {
  DEFAULT: '/mcp',
  CUSTOM_HANDLER: '/mcp/:handler',
}

/**
 * Create an MCP Nitro module with the given options
 */
export function defineMcpNitroModule(options: McpNitroModuleOptions = {}): NitroModule {
  return {
    name: 'mcp-toolkit',
    async setup(nitro: Nitro) {
      const config: McpConfig = {
        enabled: options.enabled ?? defaultMcpConfig.enabled,
        route: options.route ?? defaultMcpConfig.route,
        browserRedirect: options.browserRedirect ?? defaultMcpConfig.browserRedirect,
        name: options.name ?? defaultMcpConfig.name,
        version: options.version ?? defaultMcpConfig.version,
        dir: options.dir ?? defaultMcpConfig.dir,
      }

      if (!config.enabled) {
        return
      }

      // Store config in runtime config
      nitro.options.runtimeConfig = nitro.options.runtimeConfig || {}
      nitro.options.runtimeConfig.mcp = config

      const mcpDir = config.dir

      const paths: LoaderPaths = {
        tools: [`${mcpDir}/tools`],
        resources: [`${mcpDir}/resources`],
        prompts: [`${mcpDir}/prompts`],
        handlers: [mcpDir],
      }

      // Load all definitions and register virtual modules
      const result = await loadAllDefinitions(nitro, paths)

      // Detect Cloudflare preset
      const preset = nitro.options.preset || process.env.NITRO_PRESET || ''
      const isCloudflare = preset.includes('cloudflare')

      // Register transport virtual module
      const transportPath = isCloudflare
        ? 'nitro-mcp-toolkit/providers/cloudflare'
        : 'nitro-mcp-toolkit/providers/node'

      nitro.options.virtual['#mcp/transport'] = () => {
        return `export { default } from '${transportPath}'`
      }

      // Register auto-imports
      const definitionsPath = 'nitro-mcp-toolkit/definitions'
      if (nitro.options.imports !== false) {
        const imports = nitro.options.imports || {}
        imports.imports = imports.imports || []
        imports.imports.push(
          { name: 'defineMcpTool', from: definitionsPath },
          { name: 'defineMcpResource', from: definitionsPath },
          { name: 'defineMcpPrompt', from: definitionsPath },
          { name: 'defineMcpHandler', from: definitionsPath },
          { name: 'textResult', from: definitionsPath },
          { name: 'jsonResult', from: definitionsPath },
          { name: 'errorResult', from: definitionsPath },
          { name: 'imageResult', from: definitionsPath },
        )
        nitro.options.imports = imports
      }

      // Generate handler entry virtual module with embedded config
      const embeddedConfig = JSON.stringify({
        route: config.route,
        browserRedirect: config.browserRedirect,
        name: config.name,
        version: config.version,
      })

      nitro.options.virtual['#mcp/handler-entry'] = () => {
        return `
import transport from '#mcp/transport'
import { tools } from '#mcp/tools'
import { resources } from '#mcp/resources'
import { prompts } from '#mcp/prompts'
import { handlers } from '#mcp/handlers'
import { defaultHandler } from '#mcp/default-handler'
import { createMainMcpHandler } from 'nitro-mcp-toolkit/handler'

const embeddedConfig = ${embeddedConfig}

export default createMainMcpHandler({
  transport,
  get runtimeConfig() {
    return embeddedConfig
  },
  tools,
  resources,
  prompts,
  handlers,
  defaultHandler,
})
`
      }

      // Register handlers
      nitro.options.handlers = nitro.options.handlers || []
      nitro.options.handlers.push({
        route: config.route,
        handler: '#mcp/handler-entry',
      })

      // Register custom handler route if there are any custom handlers
      if (result.handlers && result.handlers.count > 0) {
        nitro.options.handlers.push({
          route: ROUTES.CUSTOM_HANDLER,
          handler: '#mcp/handler-entry',
        })
      }

      // Log summary
      if (result.total > 0) {
        const summary: string[] = []
        if (result.tools.count > 0) summary.push(`${result.tools.count} tool${result.tools.count > 1 ? 's' : ''}`)
        if (result.resources.count > 0) summary.push(`${result.resources.count} resource${result.resources.count > 1 ? 's' : ''}`)
        if (result.prompts.count > 0) summary.push(`${result.prompts.count} prompt${result.prompts.count > 1 ? 's' : ''}`)
        if (result.handlers.count > 0) summary.push(`${result.handlers.count} handler${result.handlers.count > 1 ? 's' : ''}`)

        console.log(`[mcp-toolkit] MCP server enabled at ${config.route} with ${summary.join(', ')}`)
      }
      else {
        console.warn('[mcp-toolkit] No MCP definitions found. Create tools, resources, or prompts in server/mcp/')
      }
    },
  }
}

/**
 * Default MCP Nitro module instance
 */
export const mcpNitroModule = defineMcpNitroModule()

export default mcpNitroModule
