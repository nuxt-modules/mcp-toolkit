import { basename, relative } from 'pathe'
import { glob } from 'tinyglobby'
import { DEFINITION_DIRS, discoverDefinitions, discoverPlugins } from './discover.ts'
import type { DiscoveredDefinition } from './discover.ts'
import type { McpModuleOptions } from './options.ts'
import type { McpNitro } from './nitro.ts'

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
export function reportDefinitions(
  nitro: McpNitro,
  route: string,
  dir: readonly string[],
  include?: McpModuleOptions['include'],
): void {
  let reported: string | undefined

  nitro.hooks.hook('compiled', async () => {
    const [definitions, plugins, misnamed] = await Promise.all([
      discoverDefinitions(dir, include),
      discoverPlugins(dir),
      Promise.all(
        dir.map(async (root) => (await nearMisses(root)).map((found) => ({ ...found, root }))),
      ).then((layers) => layers.flat()),
    ])
    const current = [
      ...definitions.map((definition) => definition.file),
      ...plugins.map((path) => basename(path)),
      ...(include?.plugins ?? []),
      ...misnamed.map((directory) => `${directory.root}/${directory.found}`),
    ].join('|')

    if (current === reported) return

    reported = current

    const where = dir.length
      ? dir.map((root) => relative(nitro.options.rootDir, root) || '.').join(', ')
      : 'included modules'

    if (definitions.length === 0) {
      nitro.logger.warn(
        `[mcp] ${route} has no definitions: nothing under ${where}/{${DEFINITION_DIRS.join(',')}}. ` +
          'The route is still mounted, and serves a server with nothing on it.',
      )
    } else {
      const [pluginsFile] = plugins
      const installed = [
        ...(pluginsFile ? [basename(pluginsFile)] : []),
        ...(include?.plugins ?? []),
      ]
      const withPlugins = installed.length ? `, with ${installed.join(', ')}` : ''

      nitro.logger.info(`[mcp] ${route} serves ${counted(definitions)} from ${where}${withPlugins}`)
    }

    for (const { found, expected, root } of misnamed) {
      const location = relative(nitro.options.rootDir, root) || '.'
      nitro.logger.warn(
        `[mcp] ${location}/${found} is not scanned, so nothing in it is served. ` +
          `Rename it to ${expected} if that is what you meant.`,
      )
    }
  })
}
