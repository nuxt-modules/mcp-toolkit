// `pathe` rather than `node:path`: these paths end up in generated code, in log
// lines and in comparisons against glob results, all of which want `/` — which
// is what tinyglobby returns on Windows too.
import { basename, dirname, join, relative } from 'pathe'
import { glob } from 'tinyglobby'
import { identityFromFilename } from './naming.ts'

/** The three directories the convention reserves, in listing order. */
export const DEFINITION_DIRS = ['tools', 'resources', 'prompts'] as const

export type DefinitionDir = (typeof DEFINITION_DIRS)[number]
export type DefinitionFiles = Partial<Record<DefinitionDir, readonly string[]>>

const PATTERN = '**/*.{ts,js,mts,mjs}'

const PLUGINS_PATTERN = 'plugins.{ts,js,mts,mjs}'
const PLUGINS_FILE_RE = /^plugins\.(?:ts|js|mts|mjs)$/

/** A definition file, and everything its path says about the definition. */
export interface DiscoveredDefinition {
  /** Which of the three directories it was found in. */
  dir: DefinitionDir
  /** Absolute path, what the generated registry imports. */
  path: string
  /** Path relative to the scanned directory, e.g. `tools/admin/purge.ts`. */
  file: string
  /** Subdirectory below the kind — `admin` above, absent at the top level. */
  group?: string
  /** Derived from the filename; a definition that names itself still wins. */
  name: string
  title: string
}

/**
 * Find every definition file under `dir`. Results are sorted, so the registry
 * generated from an unchanged tree is byte-identical between builds.
 */
export async function discoverDefinitions(
  dir: string | readonly string[],
  include: DefinitionFiles = {},
): Promise<DiscoveredDefinition[]> {
  const roots = typeof dir === 'string' ? [dir] : dir
  const layers = await Promise.all(roots.map(discoverDirectory))
  const definitions = new Map<string, DiscoveredDefinition>()
  for (const layer of layers.reverse()) {
    for (const definition of layer) definitions.set(definition.file, definition)
  }

  return [
    ...[...definitions.values()].sort(
      (a, b) =>
        DEFINITION_DIRS.indexOf(a.dir) - DEFINITION_DIRS.indexOf(b.dir) ||
        a.file.localeCompare(b.file),
    ),
    ...DEFINITION_DIRS.flatMap((kind) =>
      (include[kind] ?? []).map((path) => ({
        dir: kind,
        path,
        file: `${kind}/${basename(path)}`,
        ...identityFromFilename(basename(path)),
      })),
    ),
  ]
}

async function discoverDirectory(dir: string): Promise<DiscoveredDefinition[]> {
  const perDir = await Promise.all(
    DEFINITION_DIRS.map(async (definitionDir) => {
      const root = join(dir, definitionDir)
      const paths = await glob(PATTERN, {
        cwd: root,
        absolute: true,
        onlyFiles: true,
        expandDirectories: false,
        ignore: ['**/*.d.ts'],
      })

      return paths
        .map((path) => describe(definitionDir, root, path))
        .sort((a, b) => a.file.localeCompare(b.file))
    }),
  )

  return perDir.flat()
}

/**
 * The optional plugins file beside the three directories. Its default export is
 * installed as the endpoint's `extensionPlugins`, which is how a plugin reaches
 * a `mcp()` server: the module carries only this path, never the plugins.
 *
 * Sorted, and every match is returned — two of them is a configuration error,
 * reported where it can name the route rather than swallowed here.
 */
export async function discoverPlugins(dir: string | readonly string[]): Promise<string[]> {
  if (typeof dir !== 'string') {
    for (const root of dir) {
      const files = await discoverPlugins(root)
      if (files.length) return files
    }
    return []
  }

  const paths = await glob(PLUGINS_PATTERN, {
    cwd: dir,
    absolute: true,
    onlyFiles: true,
    expandDirectories: false,
  })

  return paths.sort((a, b) => a.localeCompare(b))
}

/** Whether `path` is the plugins file of the directory scanned at `dir`. */
export function isPluginsFile(dir: string, path: string): boolean {
  return dirname(path) === dir && PLUGINS_FILE_RE.test(basename(path))
}

function describe(dir: DefinitionDir, root: string, path: string): DiscoveredDefinition {
  const inDir = relative(root, path)
  const group = dirname(inDir)

  return {
    dir,
    path,
    file: `${dir}/${inDir}`,
    ...(group === '.' ? {} : { group }),
    ...identityFromFilename(basename(inDir)),
  }
}
