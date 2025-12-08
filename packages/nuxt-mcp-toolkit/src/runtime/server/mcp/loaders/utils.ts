import { getLayerDirectories } from '@nuxt/kit'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'

export interface LoadResult {
  count: number
  files: string[]
  overriddenCount: number
}

const RESERVED_KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'enum',
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'await',
  'abstract',
  'boolean',
  'byte',
  'char',
  'double',
  'final',
  'float',
  'goto',
  'int',
  'long',
  'native',
  'short',
  'synchronized',
  'transient',
  'volatile',
])

export function createFilePatterns(paths: string[], extensions = ['ts', 'js', 'mts', 'mjs']): string[] {
  const layerDirectories = getLayerDirectories()
  return layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern =>
      extensions
        .filter(ext => ext !== 'd.ts')
        .map(ext => resolvePath(layer.server, `${pathPattern}/*.${ext}`)),
    ),
  )
}

/**
 * Create file patterns for a specific layer
 */
export function createLayerFilePatterns(
  layerServer: string,
  paths: string[],
  extensions = ['ts', 'js', 'mts', 'mjs'],
): string[] {
  return paths.flatMap(pathPattern =>
    extensions.map(ext => resolvePath(layerServer, `${pathPattern}/*.${ext}`)),
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
  const id = filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/\W/g, '_')
  if (RESERVED_KEYWORDS.has(id)) {
    return `_${id}`
  }
  return id
}

export function createTemplateContent(
  type: string,
  entries: Array<[string, string]>,
): string {
  const imports = entries.map(([name, path]) =>
    `import ${name.replace(/-/g, '_')} from '${path}'`,
  ).join('\n')

  // Store filename in _meta for enrichment in register functions
  const enrichedExports = entries.map(([name, path]) => {
    const identifier = name.replace(/-/g, '_')
    const filename = path.split('/').pop()!

    return `(function() {
  const def = ${identifier}
  return {
    ...def,
    _meta: {
      ...def._meta,
      filename: ${JSON.stringify(filename)}
    }
  }
})()`
  }).join(',\n  ')

  return `${imports}\n\nexport const ${type} = [\n  ${enrichedExports}\n]\n`
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

  // Get layer directories and reverse the order so that:
  // - Extended layers are processed first
  // - The main app (first in getLayerDirectories) is processed last
  // This allows the app to override definitions from extended layers
  const layerDirectories = getLayerDirectories()
  const reversedLayers = [...layerDirectories].reverse()

  const definitionsMap = new Map<string, string>()
  let overriddenCount = 0

  // Process each layer separately to ensure correct override order
  for (const layer of reversedLayers) {
    const layerPatterns = createLayerFilePatterns(layer.server, paths)
    const layerFiles = await glob(layerPatterns, {
      absolute: true,
      onlyFiles: true,
      ignore: options.excludePatterns,
    })

    const filteredFiles = options.filter ? layerFiles.filter(options.filter) : layerFiles

    for (const filePath of filteredFiles) {
      const filename = filePath.split('/').pop()!
      const identifier = toIdentifier(filename)
      if (definitionsMap.has(identifier)) {
        overriddenCount++
      }
      definitionsMap.set(identifier, filePath)
    }
  }

  const total = definitionsMap.size

  return {
    count: total,
    files: Array.from(definitionsMap.values()),
    overriddenCount,
  }
}
