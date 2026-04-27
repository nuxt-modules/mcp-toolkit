import { mkdir } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import type { LoadedFile } from '../../runtime/server/mcp/loaders/utils'
import { type DiscoveredApp, discoverApps } from './discover'
import { parseSfcApp } from './parse-sfc'
import { bundleAppHtml } from './bundle'
import { emitAppModules } from './emit'

export type { DiscoveredApp } from './discover'
export { probeAppsDir } from './discover'

export interface BuiltApp extends DiscoveredApp {
  toolFile: string
  resourceFile: string
}

export interface McpAppsResult {
  apps: BuiltApp[]
  toolFiles: LoadedFile[]
  resourceFiles: LoadedFile[]
}

const APPS_DIR_DEFAULT = 'mcp'
const APPS_OUT_DIR = 'mcp-apps'

/**
 * Discover, bundle, and emit all SFC-based MCP Apps. Designed to run inside
 * `nuxt.hook('modules:done', ...)` before {@link loadAllDefinitions} so the
 * generated `.tool.ts` / `.resource.ts` files flow through the regular pipeline.
 */
export async function setupMcpApps(
  nuxt: Nuxt,
  appsDir: string | undefined,
  resolver: Resolver,
  log: ConsolaInstance,
): Promise<McpAppsResult> {
  const dir = appsDir ?? APPS_DIR_DEFAULT
  const apps = await discoverApps(dir, log)

  if (apps.length === 0) {
    return { apps: [], toolFiles: [], resourceFiles: [] }
  }

  const buildRoot = resolvePath(nuxt.options.buildDir, APPS_OUT_DIR)
  await mkdir(buildRoot, { recursive: true })

  const built: BuiltApp[] = []

  for (const app of apps) {
    try {
      const parsed = await parseSfcApp(app.sfc)
      const html = await bundleAppHtml(app, parsed.bundleSource, buildRoot, resolver, log)
      const { toolFile, resourceFile } = emitAppModules(app, parsed, html, resolver)
      built.push({ ...app, toolFile, resourceFile })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`Failed to build MCP App "${app.name}" from ${app.sfc}: ${message}`)
      throw error
    }
  }

  log.success(`Built ${built.length} MCP app${built.length === 1 ? '' : 's'} from .vue SFCs`)

  const toolFiles: LoadedFile[] = built.map(a => ({ path: a.toolFile, group: 'apps' }))
  const resourceFiles: LoadedFile[] = built.map(a => ({ path: a.resourceFile, group: 'apps' }))

  return { apps: built, toolFiles, resourceFiles }
}
