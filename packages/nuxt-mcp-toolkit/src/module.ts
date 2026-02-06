import { defineNuxtModule, addServerHandler, addServerTemplate, createResolver, addServerImports, addComponent, logger } from '@nuxt/kit'
import { loadAllDefinitions } from './runtime/server/mcp/loaders'
import { defaultMcpConfig, getMcpConfig } from './runtime/server/mcp/config'
import { ROUTES } from './runtime/server/mcp/constants'
import { addDevToolsCustomTabs } from './runtime/server/mcp/devtools'
import { detectIDE, findInstalledMCPConfig, generateDeeplinkUrl, IDE_CONFIGS, terminalLink } from './utils/ide'
import { name, version } from '../package.json'

const log = logger.withTag('@nuxtjs/mcp-toolkit')

export const { resolve } = createResolver(import.meta.url)

export type * from './runtime/server/types'

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
    name,
    version,
    configKey: 'mcp',
    docs: 'https://mcp-toolkit.nuxt.dev/getting-started/installation',
    mcp: 'https://mcp-toolkit.nuxt.dev/mcp',
  },
  defaults: defaultMcpConfig,
  async setup(options, nuxt) {
    // Cannot be used with `nuxt generate`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (nuxt.options.nitro.static || (nuxt.options as any)._generate) {
      log.warn('@nuxtjs/mcp-toolkit is not compatible with `nuxt generate` as it needs a server to run.')
      return
    }

    const resolver = createResolver(import.meta.url)

    const mcpConfig = getMcpConfig(options)

    if (!options.enabled) {
      return
    }

    addComponent({
      name: 'InstallButton',
      filePath: resolver.resolve('runtime/components/InstallButton.vue'),
    })

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/config.mjs',
      getContents: () => `export default ${JSON.stringify(mcpConfig)}`,
    })

    const mcpDir = mcpConfig.dir

    const paths = {
      tools: [`${mcpDir}/tools`],
      resources: [`${mcpDir}/resources`],
      prompts: [`${mcpDir}/prompts`],
      handlers: [mcpDir],
    }

    let mcpSummary: string | null = null

    nuxt.hook('modules:done', async () => {
      try {
        // @ts-expect-error - mcp:definitions:paths hook is provided by @nuxt/devtools-kit (optional)
        await nuxt.callHook('mcp:definitions:paths', paths)

        const result = await loadAllDefinitions(paths)

        if (result.handlers && result.handlers.count > 0) {
          addServerHandler({
            route: ROUTES.CUSTOM_HANDLER,
            handler: resolver.resolve('runtime/server/mcp/handler'),
          })
        }

        if (result.total === 0) {
          log.warn('No MCP definitions found. Create tools, resources, or prompts in server/mcp/')
        }
        else {
          const summary: string[] = []
          if (result.tools.count > 0) summary.push(`${result.tools.count} tool${result.tools.count > 1 ? 's' : ''}`)
          if (result.resources.count > 0) summary.push(`${result.resources.count} resource${result.resources.count > 1 ? 's' : ''}`)
          if (result.prompts.count > 0) summary.push(`${result.prompts.count} prompt${result.prompts.count > 1 ? 's' : ''}`)
          if (result.handlers.count > 0) summary.push(`${result.handlers.count} handler${result.handlers.count > 1 ? 's' : ''}`)

          mcpSummary = summary.join(', ')
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error('Failed to initialize MCP server')
        log.error(`Error: ${errorMessage}`)
        throw error
      }
    })

    nuxt.hook('listen', (_, listener) => {
      if (!mcpSummary) return

      const ide = detectIDE()
      if (ide) {
        const baseUrl = listener.url.replace(/\/$/, '')
        const mcpUrl = `${baseUrl}${options.route}`

        // Check if the MCP server is already installed
        const installedConfig = findInstalledMCPConfig(ide, nuxt.options.rootDir, mcpUrl)
        if (installedConfig) {
          log.success(`\`${options.route}\` enabled with ${mcpSummary} · MCP server already installed in \`${installedConfig.displayPath}\``)
          return
        }

        const ideName = IDE_CONFIGS[ide].name
        const deeplinkUrl = generateDeeplinkUrl(baseUrl, options.route!, ide, options.name || 'mcp-server')
        log.info(`${ideName} detected. ${terminalLink('Install Nuxt MCP server', deeplinkUrl)}`)
        log.success(`\`${options.route}\` enabled with ${mcpSummary}`)
      }
      else {
        log.success(`\`${options.route}\` enabled with ${mcpSummary}`)
      }
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

    // Generate transport template based on preset (cloudflare vs node)
    let isCloudflare = false
    if (!nuxt.options.dev) {
      nuxt.hook('nitro:config', (nitroConfig) => {
        const preset = nitroConfig.preset || process.env.NITRO_PRESET || ''
        isCloudflare = preset.includes('cloudflare')
      })
    }

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/transport.mjs',
      getContents: () => {
        const provider = isCloudflare ? 'cloudflare' : 'node'
        return `export { default } from '${resolver.resolve(`runtime/server/mcp/providers/${provider}`)}'`
      },
    })

    const mcpDefinitionsPath = resolver.resolve('runtime/server/mcp/definitions')

    addServerImports([
      'defineMcpTool',
      'defineMcpResource',
      'defineMcpPrompt',
      'defineMcpHandler',
      'textResult',
      'jsonResult',
      'errorResult',
      'imageResult',
    ].map(name => ({ name, from: mcpDefinitionsPath })))

    addServerHandler({
      route: options.route,
      handler: resolver.resolve('runtime/server/mcp/handler'),
    })

    addServerHandler({
      route: `${options.route}/deeplink`,
      handler: resolver.resolve('runtime/server/mcp/deeplink'),
    })

    addServerHandler({
      route: `${options.route}/badge.svg`,
      handler: resolver.resolve('runtime/server/mcp/badge-image'),
    })

    addDevToolsCustomTabs(nuxt, options)
  },
})
