import { basename, relative } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFINITION_DIRS, discoverDefinitions, discoverPlugins } from './discover.ts'
import type { DiscoveredDefinition } from './discover.ts'
import type { Nitro } from 'nitro/types'

const SCANNED = new Set<string>(DEFINITION_DIRS)

interface NearMiss {
  found: string
  expected: string
}

/**
 * Directories named nearly like a scanned one — `tool/`, `Resources/`. Only
 * near misses are reported, so a real `lib/` next to them stays quiet.
 */
async function nearMisses(dir: string): Promise<NearMiss[]> {
  const found = await glob('*', {
    cwd: dir,
    onlyDirectories: true,
    deep: 1,
    expandDirectories: false,
  })

  return found.flatMap((entry) => {
    // tinyglobby reports directories with a trailing slash.
    const name = entry.replace(/\/$/, '')
    const expected = `${name.toLowerCase().replace(/s$/, '')}s`

    return SCANNED.has(expected) && !SCANNED.has(name) ? [{ found: name, expected }] : []
  })
}

function counted(definitions: DiscoveredDefinition[]): string {
  return DEFINITION_DIRS.flatMap((dir) => {
    const count = definitions.filter((definition) => definition.dir === dir).length

    return count === 0 ? [] : [`${count} ${count === 1 ? dir.slice(0, -1) : dir}`]
  }).join(', ')
}

/**
 * Print what an endpoint ends up serving, once per build and again whenever the
 * set changes in dev.
 *
 * Without it a definition under a directory no `mcp()` points at — a forgotten
 * instance, a renamed folder, `tool/` for `tools/` — is served by nobody and
 * says nothing.
 */
export function reportDefinitions(nitro: Nitro, route: string, dir: string): void {
  let reported: string | undefined

  nitro.hooks.hook('compiled', async () => {
    const [definitions, plugins, misnamed] = await Promise.all([
      discoverDefinitions(dir),
      discoverPlugins(dir),
      nearMisses(dir),
    ])
    const current = [
      ...definitions.map((definition) => definition.file),
      ...plugins.map((path) => basename(path)),
      ...misnamed.map((directory) => directory.found),
    ].join('|')

    if (current === reported) return

    reported = current

    const where = relative(nitro.options.rootDir, dir) || '.'

    if (definitions.length === 0) {
      nitro.logger.warn(
        `[mcp] ${route} has no definitions: nothing under ${where}/{${DEFINITION_DIRS.join(',')}}. ` +
          'The route is still mounted, and serves a server with nothing on it.',
      )
    } else {
      const [pluginsFile] = plugins
      const installed = pluginsFile ? `, with ${basename(pluginsFile)}` : ''

      nitro.logger.info(`[mcp] ${route} serves ${counted(definitions)} from ${where}${installed}`)
    }

    for (const { found, expected } of misnamed) {
      nitro.logger.warn(
        `[mcp] ${where}/${found} is not scanned, so nothing in it is served. ` +
          `Rename it to ${expected} if that is what you meant.`,
      )
    }
  })
}
