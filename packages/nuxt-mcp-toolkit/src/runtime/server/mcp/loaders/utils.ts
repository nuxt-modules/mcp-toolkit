import { resolve as resolvePath, relative as relativePath, sep } from 'node:path'
import { getLayerDirectories } from '@nuxt/kit'
import { glob } from 'tinyglobby'

export interface LoadedFile {
  path: string
  group?: string
}

export interface LoadResult {
  count: number
  files: LoadedFile[]
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

/**
 * Normalize a path to always use forward slashes (for cross-platform consistency).
 * `tinyglobby` returns forward-slash paths, but `path.resolve()` uses the platform
 * separator, so we normalize everything to `/`.
 */
function normalizePath(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/')
}

export function createFilePatterns(paths: string[], extensions = ['ts', 'js', 'mts', 'mjs'], recursive = false): string[] {
  const layerDirectories = getLayerDirectories()
  const pattern = recursive ? '**/*' : '*'
  return layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern =>
      extensions.map(ext => normalizePath(resolvePath(layer.server, `${pathPattern}/${pattern}.${ext}`))),
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
  recursive = false,
): string[] {
  const pattern = recursive ? '**/*' : '*'
  return paths.flatMap(pathPattern =>
    extensions.map(ext => normalizePath(resolvePath(layerServer, `${pathPattern}/${pattern}.${ext}`))),
  )
}

export function createExcludePatterns(paths: string[], subdirs: string[]): string[] {
  const layerDirectories = getLayerDirectories()
  return layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern =>
      subdirs.map(subdir => normalizePath(resolvePath(layer.server, `${pathPattern}/${subdir}/**`))),
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

export interface TemplateEntry {
  identifier: string
  path: string
  group?: string
}

export function createTemplateContent(
  type: string,
  entries: TemplateEntry[],
): string {
  const imports = entries.map(({ identifier, path }) =>
    `import ${identifier.replace(/-/g, '_')} from '${path}'`,
  ).join('\n')

  // Store filename and group in _meta for enrichment in register functions
  const enrichedExports = entries.map(({ identifier, path, group }) => {
    const safeId = identifier.replace(/-/g, '_')
    const filename = path.split('/').pop()!
    const groupMeta = group ? `,\n      group: ${JSON.stringify(group)}` : ''

    return `(function() {
  const def = ${safeId}
  return {
    ...def,
    _meta: {
      ...def._meta,
      filename: ${JSON.stringify(filename)}${groupMeta}
    }
  }
})()`
  }).join(',\n  ')

  return `${imports}\n\nexport const ${type} = [\n  ${enrichedExports}\n]\n`
}

/**
 * Find index files (index.ts, index.js, etc.) in the given paths
 * Returns the file path from the highest priority layer (app overrides extended layers)
 */
export async function findIndexFile(paths: string[], extensions = ['ts', 'js', 'mts', 'mjs']): Promise<string | null> {
  if (paths.length === 0) {
    return null
  }

  // Get layer directories - first one is the main app (highest priority)
  const layerDirectories = getLayerDirectories()

  // Check each layer in order (main app first)
  for (const layer of layerDirectories) {
    const indexPatterns = paths.flatMap(pathPattern =>
      extensions.map(ext => normalizePath(resolvePath(layer.server, `${pathPattern}/index.${ext}`))),
    )

    const indexFiles = await glob(indexPatterns, {
      absolute: true,
      onlyFiles: true,
    })

    if (indexFiles.length > 0) {
      // Return the first found index file in this layer
      return indexFiles[0]!
    }
  }

  return null
}

/**
 * Compute the relative path of a file within its base directory,
 * and extract the group (subdirectory) if present.
 */
function computeRelativeInfo(
  filePath: string,
  layerServer: string,
  paths: string[],
): { relativePath: string, group?: string } {
  for (const pathPattern of paths) {
    const baseDir = normalizePath(resolvePath(layerServer, pathPattern))
    const rel = normalizePath(relativePath(baseDir, filePath))

    if (!rel.startsWith('..')) {
      const parts = rel.split('/')
      if (parts.length > 1) {
        const group = parts.slice(0, -1).join('/')
        return { relativePath: rel, group }
      }
      return { relativePath: rel }
    }
  }
  const filename = normalizePath(filePath).split('/').pop()!
  return { relativePath: filename }
}

export async function loadDefinitionFiles(
  paths: string[],
  options: {
    excludePatterns?: string[]
    filter?: (filePath: string) => boolean
    recursive?: boolean
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

  const definitionsMap = new Map<string, LoadedFile>()
  let overriddenCount = 0

  // Process each layer separately to ensure correct override order
  for (const layer of reversedLayers) {
    const layerPatterns = createLayerFilePatterns(layer.server, paths, undefined, options.recursive)
    const layerFiles = await glob(layerPatterns, {
      absolute: true,
      onlyFiles: true,
      ignore: [...(options.excludePatterns || []), '**/*.d.ts'],
    })

    const filteredFiles = options.filter ? layerFiles.filter(options.filter) : layerFiles

    for (const filePath of filteredFiles) {
      const { relativePath, group } = computeRelativeInfo(filePath, layer.server, paths)
      const identifier = toIdentifier(relativePath)
      if (definitionsMap.has(identifier)) {
        overriddenCount++
      }
      definitionsMap.set(identifier, { path: filePath, group })
    }
  }

  const total = definitionsMap.size

  return {
    count: total,
    files: Array.from(definitionsMap.values()),
    overriddenCount,
  }
}
