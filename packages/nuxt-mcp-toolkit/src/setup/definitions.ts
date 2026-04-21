import { addServerHandler } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import { loadAllDefinitions } from '../runtime/server/mcp/loaders'
import { ROUTES } from '../runtime/server/mcp/constants'
import { detectIDE, findInstalledMCPConfig, generateDeeplinkUrl, IDE_CONFIGS, terminalLink } from '../utils/ide'
import type { ModuleOptions } from '../module'

export interface DefinitionsPaths {
  tools: string[]
  resources: string[]
  prompts: string[]
  handlers: string[]
}

/**
 * Build the default scan paths from the resolved MCP `dir`. The hook
 * `mcp:definitions:paths` lets users append additional directories
 * before discovery runs.
 */
export function buildDefaultPaths(mcpDir: string): DefinitionsPaths {
  return {
    tools: [`${mcpDir}/tools`],
    resources: [`${mcpDir}/resources`],
    prompts: [`${mcpDir}/prompts`],
    handlers: [mcpDir],
  }
}

/**
 * Run definition discovery once Nuxt is done loading modules and report
 * a one-line summary on dev-server `listen`. Both hooks share the
 * `mcpSummary` closure so the listener can stay silent when no
 * definitions were found.
 */
export function setupDefinitionsLoader(
  nuxt: Nuxt,
  paths: DefinitionsPaths,
  options: ModuleOptions,
  resolver: Resolver,
  log: ConsolaInstance,
): void {
  let mcpSummary: string | null = null

  nuxt.hook('modules:done', async () => {
    try {
      const callCustomHook = nuxt.callHook as (name: string, ...args: unknown[]) => Promise<void>
      await callCustomHook('mcp:definitions:paths', paths)

      const result = await loadAllDefinitions(paths)

      if (result.handlers && result.handlers.count > 0) {
        addServerHandler({
          route: ROUTES.CUSTOM_HANDLER,
          handler: resolver.resolve('runtime/server/mcp/handler'),
        })
      }

      if (result.total === 0) {
        log.warn('No MCP definitions found. Create tools, resources, or prompts in server/mcp/')
        return
      }

      const summary: string[] = []
      if (result.tools.count > 0) summary.push(`${result.tools.count} tool${result.tools.count > 1 ? 's' : ''}`)
      if (result.resources.count > 0) summary.push(`${result.resources.count} resource${result.resources.count > 1 ? 's' : ''}`)
      if (result.prompts.count > 0) summary.push(`${result.prompts.count} prompt${result.prompts.count > 1 ? 's' : ''}`)
      if (result.handlers.count > 0) summary.push(`${result.handlers.count} handler${result.handlers.count > 1 ? 's' : ''}`)
      mcpSummary = summary.join(', ')
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
    const route = options.route ?? '/mcp'

    const ide = detectIDE()
    if (!ide) {
      log.success(`\`${route}\` enabled with ${mcpSummary}`)
      return
    }

    const baseUrl = listener.url.replace(/\/$/, '')
    const mcpUrl = `${baseUrl}${route}`

    const installedConfig = findInstalledMCPConfig(ide, nuxt.options.rootDir, mcpUrl)
    if (installedConfig) {
      log.success(`\`${route}\` enabled with ${mcpSummary} · MCP server already installed in \`${installedConfig.displayPath}\``)
      return
    }

    const ideName = IDE_CONFIGS[ide].name
    const deeplinkUrl = generateDeeplinkUrl(baseUrl, route, ide, options.name || 'mcp-server')
    log.info(`${ideName} detected. ${terminalLink('Install Nuxt MCP server', deeplinkUrl)}`)
    log.success(`\`${route}\` enabled with ${mcpSummary}`)
  })
}
