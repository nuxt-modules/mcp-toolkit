import { mkdir } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'
import type { ConsolaInstance } from 'consola'
import type { LoadedFile } from '../../runtime/server/mcp/loaders/utils'
import { type DiscoveredApp, discoverApps } from './discover'
import { parseSfcApp, type McpAppStaticFields } from './parse-sfc'
import { bundleAppHtml } from './bundle'
import { emitAppModules, type ResolvedAttribution } from './emit'

export type { DiscoveredApp } from './discover'
export { probeAppsDir } from './discover'

export interface BuiltApp extends DiscoveredApp {
  toolFile: string
  resourceFile: string
  attribution: ResolvedAttribution
}

export interface McpAppsResult {
  apps: BuiltApp[]
  toolFiles: LoadedFile[]
  resourceFiles: LoadedFile[]
}

const APPS_DIR_DEFAULT = 'mcp'
const APPS_OUT_DIR = 'mcp-apps'
const DEFAULT_ATTRIBUTION = 'apps'

/**
 * Resolve the named-handler attribution for one app. Precedence:
 *   1. `defineMcpApp({ attachTo: '...' })` — explicit literal override.
 *   2. First sub-directory of the SFC under `app/mcp/` (e.g. `finder`).
 *   3. The default `'apps'` handler.
 *
 * `group` follows the same chain, falling back to the resolved `attachTo`
 * so apps surfaced on the same handler share a default group label.
 */
function resolveAttribution(
  inferred: string | undefined,
  staticFields: McpAppStaticFields,
): ResolvedAttribution {
  const attachTo = staticFields.attachTo ?? inferred ?? DEFAULT_ATTRIBUTION
  const group = staticFields.group ?? attachTo
  return { attachTo, group }
}

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
      const attribution = resolveAttribution(app.inferredAttribution, parsed.staticFields)
      const html = await bundleAppHtml(app, parsed.bundleSource, buildRoot, resolver, log)
      const { toolFile, resourceFile } = emitAppModules(app, parsed, html, attribution, resolver)
      built.push({ ...app, toolFile, resourceFile, attribution })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`Failed to build MCP App "${app.name}" from ${app.sfc}: ${message}`)
      throw error
    }
  }

  log.success(`Built ${built.length} MCP app${built.length === 1 ? '' : 's'} from .vue SFCs`)

  // Attribute every app-derived tool and resource to its resolved handler.
  // With `defaultHandlerStrategy: 'orphans'` this automatically excludes them
  // from the default `/mcp` route, so they only surface on `/mcp/<handler>`.
  const toolFiles: LoadedFile[] = built.map(a => ({
    path: a.toolFile,
    group: a.attribution.group,
    handler: a.attribution.attachTo,
  }))
  const resourceFiles: LoadedFile[] = built.map(a => ({
    path: a.resourceFile,
    group: a.attribution.group,
    handler: a.attribution.attachTo,
  }))

  return { apps: built, toolFiles, resourceFiles }
}
