import { basename, dirname, join, relative } from 'node:path'
import { glob } from 'tinyglobby'
import { identityFromFilename } from './naming.ts'

/** The three directories the convention reserves, in listing order. */
export const DEFINITION_DIRS = ['tools', 'resources', 'prompts'] as const

export type DefinitionDir = (typeof DEFINITION_DIRS)[number]

const PATTERN = '**/*.{ts,js,mts,mjs}'

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
export async function discoverDefinitions(dir: string): Promise<DiscoveredDefinition[]> {
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

function describe(dir: DefinitionDir, root: string, path: string): DiscoveredDefinition {
  const inDir = relative(root, path).replace(/\\/g, '/')
  const group = dirname(inDir)

  return {
    dir,
    path,
    file: `${dir}/${inDir}`,
    ...(group === '.' ? {} : { group }),
    ...identityFromFilename(basename(inDir)),
  }
}
