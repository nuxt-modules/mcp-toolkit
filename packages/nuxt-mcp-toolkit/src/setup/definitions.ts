import { addServerHandler } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import { loadAllDefinitions } from '../runtime/server/mcp/loaders'
import { ROUTES } from '../runtime/server/mcp/constants'
import { probeAppsDir } from './mcp-apps/discover'
import { detectIDE, findInstalledMCPConfig, generateDeeplinkUrl, IDE_CONFIGS, terminalLink } from '../utils/ide'
import type { ModuleOptions } from '../module'

const DEFAULT_APPS_DIR = 'mcp'

export interface DefinitionsPaths {
  tools: string[]
  resources: string[]
  prompts: string[]
  handlers: string[]
}

export interface DefinitionsLoaderConfig {
  /** Sub-directory under the app dir where SFC MCP Apps live. Defaults to `mcp` (i.e. `app/mcp/*.vue`). */
  appsDir?: string
}

/** Build default scan paths from the resolved MCP `dir`. */
export function buildDefaultPaths(mcpDir: string): DefinitionsPaths {
  return {
    tools: [`${mcpDir}/tools`],
    resources: [`${mcpDir}/resources`],
    prompts: [`${mcpDir}/prompts`],
    handlers: [mcpDir],
  }
}

/** Run definition discovery on `modules:done` and report a summary on dev `listen`. */
export function setupDefinitionsLoader(
  nuxt: Nuxt,
  paths: DefinitionsPaths,
  options: ModuleOptions,
  resolver: Resolver,
  log: ConsolaInstance,
  config: DefinitionsLoaderConfig,
): void {
  let mcpSummary: string | null = null
  const appsDir = config.appsDir ?? DEFAULT_APPS_DIR

  nuxt.hook('modules:done', async () => {
    try {
      const callCustomHook = nuxt.callHook as (name: string, ...args: unknown[]) => Promise<void>
      await callCustomHook('mcp:definitions:paths', paths)

      // Lazy-load the apps pipeline only when at least one layer carries the dir.
      // Users without `app/mcp/*.vue` pay zero setup/runtime cost.
      const appsResult = probeAppsDir(appsDir)
        ? await (await import('./mcp-apps')).setupMcpApps(nuxt, appsDir, resolver, log)
        : { apps: [], toolFiles: [], resourceFiles: [] }

      const result = await loadAllDefinitions(paths, {
        toolFiles: appsResult.toolFiles,
        resourceFiles: appsResult.resourceFiles,
      })

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
      if (appsResult.apps.length > 0) summary.push(`${appsResult.apps.length} app${appsResult.apps.length > 1 ? 's' : ''}`)
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
