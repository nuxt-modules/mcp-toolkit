import { existsSync } from 'node:fs'
import { resolve as resolvePath, basename, sep } from 'node:path'
import { getLayerDirectories } from '@nuxt/kit'
import { glob } from 'tinyglobby'

export interface DiscoveredApp {
  /** Kebab-case app name derived from the SFC filename. */
  name: string
  /** Absolute path to the source `.vue` SFC. */
  sfc: string
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

/** Cheap existence check: any layer carries `<layer.app>/<appsDir>/`. */
export function probeAppsDir(appsDir: string): boolean {
  for (const layer of getLayerDirectories()) {
    if (existsSync(resolvePath(layer.app, appsDir))) return true
  }
  return false
}

/** Discover `.vue` SFCs across every Nuxt layer; later layers win on collision. */
export async function discoverApps(appsDir: string): Promise<DiscoveredApp[]> {
  const layers = getLayerDirectories()
  const seen = new Map<string, DiscoveredApp>()
  const skipped: string[] = []

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
      seen.set(name, { name, sfc: file })
    }
  }

  if (skipped.length) {
    throw new Error(
      `MCP App SFCs with unsafe names (must match ${SAFE_APP_NAME}): \n  - ${skipped.join('\n  - ')}`,
    )
  }

  return Array.from(seen.values())
}
