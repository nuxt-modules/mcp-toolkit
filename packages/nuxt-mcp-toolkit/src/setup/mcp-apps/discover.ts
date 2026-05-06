import { existsSync } from 'node:fs'
import { resolve as resolvePath, basename, sep, relative as relativePath } from 'node:path'
import { getLayerDirectories } from '@nuxt/kit'
import { glob } from 'tinyglobby'
import type { ConsolaInstance } from 'consola'

export interface DiscoveredApp {
  /** Kebab-case app name derived from the SFC filename. */
  name: string
  /** Absolute path to the source `.vue` SFC. */
  sfc: string
  /**
   * First sub-directory between the `app/mcp/` root and the SFC, used as the
   * default named-handler attribution and group when the macro doesn't
   * specify `attachTo` / `group` explicitly.
   *
   * `undefined` when the SFC lives directly under `app/mcp/` (default
   * attribution `'apps'`).
   */
  inferredAttribution?: string
}

/** Mirrors {@link assertSafeAppName} on the runtime side — keep them in sync. */
const SAFE_APP_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/

function normalize(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

export function sfcToAppName(sfcPath: string): string {
  return basename(sfcPath).replace(/\.vue$/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

/**
 * Pull the first sub-directory between the apps root and the SFC, if any.
 * Returns `undefined` for SFCs sitting directly under `<appsDir>/`.
 *
 * `app/mcp/finder/stay-finder.vue`        → `'finder'`
 * `app/mcp/finder/admin/audit-log.vue`    → `'finder'`  (only first level)
 * `app/mcp/color-picker.vue`              → `undefined`
 */
export function inferAttribution(sfcPath: string, appsRoot: string): string | undefined {
  const rel = normalize(relativePath(appsRoot, sfcPath))
  if (!rel || rel.startsWith('..')) return undefined
  const segments = rel.split('/')
  return segments.length > 1 ? segments[0] : undefined
}

/** Cheap existence check: any layer carries `<layer.app>/<appsDir>/`. */
export function probeAppsDir(appsDir: string): boolean {
  for (const layer of getLayerDirectories()) {
    if (existsSync(resolvePath(layer.app, appsDir))) return true
  }
  return false
}

/** Discover `.vue` SFCs across every Nuxt layer; later layers win on collision. */
export async function discoverApps(appsDir: string, log?: ConsolaInstance): Promise<DiscoveredApp[]> {
  const layers = getLayerDirectories()
  const seen = new Map<string, DiscoveredApp>()
  const skipped: string[] = []
  const candidates = new Map<string, string[]>()

  const unsafeAttributions: string[] = []

  for (const layer of [...layers].reverse()) {
    const root = normalize(resolvePath(layer.app, appsDir))
    const pattern = `${root}/**/*.vue`
    const files = await glob([pattern], { absolute: true, onlyFiles: true })
    for (const file of files) {
      const normalised = normalize(file)
      // Defence against symlinks pointing outside the apps directory.
      if (!normalised.startsWith(`${root}/`)) continue
      const name = sfcToAppName(file)
      if (!SAFE_APP_NAME.test(name)) {
        skipped.push(`${file} → ${JSON.stringify(name)}`)
        continue
      }
      const inferredAttribution = inferAttribution(normalised, root)
      if (inferredAttribution !== undefined && !SAFE_APP_NAME.test(inferredAttribution)) {
        unsafeAttributions.push(`${file} → directory ${JSON.stringify(inferredAttribution)}`)
        continue
      }
      const list = candidates.get(name) ?? []
      list.push(file)
      candidates.set(name, list)
      seen.set(name, { name, sfc: file, inferredAttribution })
    }
  }

  if (skipped.length) {
    throw new Error(
      `MCP App SFCs with unsafe names (must match ${SAFE_APP_NAME}): \n  - ${skipped.join('\n  - ')}`,
    )
  }
  if (unsafeAttributions.length) {
    throw new Error(
      `MCP App sub-directories must match ${SAFE_APP_NAME} (used as the named handler attribution): \n  - ${unsafeAttributions.join('\n  - ')}`,
    )
  }
  for (const [name, files] of candidates) {
    if (files.length < 2) continue
    const winner = seen.get(name)!.sfc
    const losers = files.filter(f => f !== winner)
    log?.warn(
      `Multiple MCP App SFCs resolve to "${name}". Using ${winner} `
      + `(overrides: ${losers.join(', ')}).`,
    )
  }

  return Array.from(seen.values())
}
