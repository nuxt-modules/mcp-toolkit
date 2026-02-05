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

/**
 * Create file patterns for scanning directories
 */
export function createFilePatterns(
  scanDirs: string[],
  paths: string[],
  extensions = ['ts', 'js', 'mts', 'mjs'],
): string[] {
  return scanDirs.flatMap(scanDir =>
    paths.flatMap(pathPattern =>
      extensions.map(ext => resolvePath(scanDir, `${pathPattern}/*.${ext}`)),
    ),
  )
}

export function createExcludePatterns(
  scanDirs: string[],
  paths: string[],
  subdirs: string[],
): string[] {
  return scanDirs.flatMap(scanDir =>
    paths.flatMap(pathPattern =>
      subdirs.map(subdir => resolvePath(scanDir, `${pathPattern}/${subdir}/**`)),
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

/**
 * Find index files (index.ts, index.js, etc.) in the given paths
 * Returns the file path from the first scan directory that has one
 */
export async function findIndexFile(
  scanDirs: string[],
  paths: string[],
  extensions = ['ts', 'js', 'mts', 'mjs'],
): Promise<string | null> {
  if (paths.length === 0) {
    return null
  }

  // Check each scan directory in order
  for (const scanDir of scanDirs) {
    const indexPatterns = paths.flatMap(pathPattern =>
      extensions.map(ext => resolvePath(scanDir, `${pathPattern}/index.${ext}`)),
    )

    const indexFiles = await glob(indexPatterns, {
      absolute: true,
      onlyFiles: true,
    })

    if (indexFiles.length > 0) {
      // Return the first found index file in this directory
      return indexFiles[0]!
    }
  }

  return null
}

/**
 * Load definition files from scan directories
 */
export async function loadDefinitionFiles(
  scanDirs: string[],
  paths: string[],
  options: {
    excludePatterns?: string[]
    filter?: (filePath: string) => boolean
  } = {},
): Promise<LoadResult> {
  if (paths.length === 0 || scanDirs.length === 0) {
    return { count: 0, files: [], overriddenCount: 0 }
  }

  const definitionsMap = new Map<string, string>()
  let overriddenCount = 0

  // Process each scan directory (later ones override earlier ones)
  for (const scanDir of scanDirs) {
    const patterns = paths.flatMap(pathPattern =>
      ['ts', 'js', 'mts', 'mjs'].map(ext => resolvePath(scanDir, `${pathPattern}/*.${ext}`)),
    )

    const files = await glob(patterns, {
      absolute: true,
      onlyFiles: true,
      ignore: [...(options.excludePatterns || []), '**/*.d.ts'],
    })

    const filteredFiles = options.filter ? files.filter(options.filter) : files

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
