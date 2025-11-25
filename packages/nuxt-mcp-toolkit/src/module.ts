import { defineNuxtModule, addServerHandler, createResolver, addServerImports, logger } from '@nuxt/kit'
import { defu } from 'defu'
import { join } from 'pathe'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { confirm, intro, outro, isCancel, cancel, log as clackLog } from '@clack/prompts'
import { loadAllDefinitions } from './runtime/server/mcp/loaders'
import { defaultMcpConfig } from './runtime/server/mcp/config'
import { ROUTES } from './runtime/server/mcp/constants'
import { addDevToolsCustomTabs } from './runtime/server/mcp/devtools'
import { name, version } from '../package.json'

const log = logger.withTag('nuxt-mcp-toolkit')

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
      return
    }

    const mcpDir = options.dir ?? defaultMcpConfig.dir

    const paths = {
      tools: [`${mcpDir}/tools`],
      resources: [`${mcpDir}/resources`],
      prompts: [`${mcpDir}/prompts`],
      handlers: [mcpDir],
    }

    nuxt.hook('modules:done', async () => {
      try {
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

          const boxContent: string[] = []
          if (options.name) {
            boxContent.push(`${options.name}`)
          }
          boxContent.push(`Route: ${options.route}`)
          boxContent.push(`Definitions: ${summary.join(', ')}`)

          log.box({
            title: 'MCP Server',
            message: boxContent.join('\n'),
          })
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error('Failed to initialize MCP server')
        log.error(`Error: ${errorMessage}`)
        throw error
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
      {
        name: 'defineMcpHandler',
        from: resolver.resolve('runtime/server/mcp/definitions'),
      },
    ])

    addServerHandler({
      route: options.route,
      handler: resolver.resolve('runtime/server/mcp/handler'),
    })

    addDevToolsCustomTabs(nuxt, options)
  },
  async onInstall() {
    intro('Nuxt MCP Toolkit Setup')

    const cwd = process.cwd()
    const mcpDir = join(cwd, 'server/mcp')
    const hasMcpDir = existsSync(mcpDir)

    if (hasMcpDir) {
      clackLog.info(`MCP directory detected at ${mcpDir}`)
    }

    const shouldCreate = await confirm({
      message: hasMcpDir
        ? 'Do you want to ensure all MCP subdirectories (tools, resources, prompts) exist?'
        : 'Do you want to create the default MCP directory structure (server/mcp)?',
    })

    if (isCancel(shouldCreate)) {
      cancel('Setup cancelled')
      return
    }

    if (shouldCreate) {
      const dirs = ['tools', 'resources', 'prompts']
      for (const dir of dirs) {
        const path = join(mcpDir, dir)
        await mkdir(path, { recursive: true })
      }
      clackLog.success('MCP directories created!')
    }

    outro('You are ready to build MCP servers!')
  },
})
