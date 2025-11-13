import { getLayerDirectories } from '@nuxt/kit'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'

export interface LoadResult {
  count: number
  files: string[]
  overriddenCount: number
}

export function createFilePatterns(paths: string[], extensions = ['ts', 'js', 'mts', 'mjs']): string[] {
  const layerDirectories = getLayerDirectories()
  return layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern =>
      extensions.map(ext => resolvePath(layer.server, `${pathPattern}/*.${ext}`)),
    ),
  )
}

export function createExcludePatterns(paths: string[], subdirs: string[]): string[] {
  const layerDirectories = getLayerDirectories()
  return layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern =>
      subdirs.map(subdir => resolvePath(layer.server, `${pathPattern}/${subdir}/**`)),
    ),
  )
}

export function toIdentifier(filename: string): string {
  return filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/\W/g, '_')
}

export function createTemplateContent(
  type: string,
  entries: Array<[string, string]>,
): string {
  const imports = entries.map(([name, path]) =>
    `import ${name.replace(/-/g, '_')} from '${path}'`,
  ).join('\n')
  const exports = entries.map(([name]) => name.replace(/-/g, '_')).join(', ')
  return `${imports}\n\nexport const ${type} = [${exports}]\n`
}

export async function loadDefinitionFiles(
  paths: string[],
  options: {
    excludePatterns?: string[]
    filter?: (filePath: string) => boolean
  } = {},
): Promise<LoadResult> {
  if (paths.length === 0) {
    return { count: 0, files: [], overriddenCount: 0 }
  }

  const patterns = createFilePatterns(paths)
  const files = await glob(patterns, {
    absolute: true,
    onlyFiles: true,
    ignore: options.excludePatterns,
  })

  const definitionsMap = new Map<string, string>()
  const filteredFiles = options.filter ? files.filter(options.filter) : files
  let overriddenCount = 0

  for (const filePath of filteredFiles) {
    const filename = filePath.split('/').pop()!
    const identifier = toIdentifier(filename)
    if (definitionsMap.has(identifier)) {
      overriddenCount++
    }
    definitionsMap.set(identifier, filePath)
  }

  const total = definitionsMap.size

  return {
    count: total,
    files: Array.from(definitionsMap.values()),
    overriddenCount,
  }
}
