import { resolve as resolvePath, relative as relativePath, sep } from 'node:path'
import { getLayerDirectories } from '@nuxt/kit'
import { glob } from 'tinyglobby'

/**
 * A discovered MCP definition file with optional context picked up from its
 * scan root: `group` (subdirectory under the base scan path) and `handler`
 * (the named handler this file is folder-attributed to, if any).
 */
export interface LoadedFile {
  path: string
  group?: string
  /**
   * Named handler this file belongs to (folder convention).
   * Set when the file lives under `<mcpDir>/handlers/<name>/{tools|resources|prompts}/`.
   * Surfaces on registered definitions as `_meta.handler`.
   */
  handler?: string
}

export interface LoadResult {
  count: number
  files: LoadedFile[]
  overriddenCount: number
}

/**
 * One scan root for `loadDefinitionFiles`. Pass `handler` to auto-attribute
 * every file found under `path` to the named handler.
 */
export interface ScanRoot {
  path: string
  handler?: string
}

const RESERVED_KEYWORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'import', 'in', 'instanceof', 'new', 'return', 'super', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'enum', 'implements', 'interface', 'let', 'package', 'private', 'protected',
  'public', 'static', 'await', 'abstract', 'boolean', 'byte', 'char', 'double',
  'final', 'float', 'goto', 'int', 'long', 'native', 'short', 'synchronized',
  'transient', 'volatile',
])

/** Cross-platform forward-slash normalization (tinyglobby always returns `/`). */
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

function createLayerFilePatterns(
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
  return RESERVED_KEYWORDS.has(id) ? `_${id}` : id
}

export interface TemplateEntry {
  identifier: string
  path: string
  group?: string
  handler?: string
}

export interface CreateTemplateOptions {
  /**
   * When provided, the rendered IIFE will spread `{ name: nameOverride(entry), ...def }`
   * so the user-provided `name` (if any) is overridden by the convention.
   * Used by the handlers template to force `name = <dirName>` for folder handlers.
   */
  nameOverride?: (entry: TemplateEntry) => string | undefined
}

/** Render the IIFE that imports a definition and enriches its `_meta`. */
function renderEntry(entry: TemplateEntry, options: CreateTemplateOptions = {}): string {
  const safeId = entry.identifier.replace(/-/g, '_')
  const filename = entry.path.split('/').pop()!
  const name = options.nameOverride?.(entry)
  const namePrefix = name ? `name: ${JSON.stringify(name)}, ` : ''
  const groupMeta = entry.group ? `,\n      group: ${JSON.stringify(entry.group)}` : ''
  const handlerMeta = entry.handler ? `,\n      handler: ${JSON.stringify(entry.handler)}` : ''
  return `(function() {
  const def = ${safeId}
  return {
    ${namePrefix}...def,
    _meta: {
      ...def._meta,
      filename: ${JSON.stringify(filename)}${groupMeta}${handlerMeta}
    }
  }
})()`
}

/**
 * Render a virtual server module that exports an array of enriched definitions
 * (every entry imported, then wrapped in an IIFE that injects `_meta.filename`,
 * `_meta.group` and `_meta.handler` while preserving any user-provided `_meta`).
 */
export function createTemplateContent(
  exportName: string,
  entries: TemplateEntry[],
  options: CreateTemplateOptions = {},
): string {
  if (entries.length === 0) {
    return `export const ${exportName} = []\n`
  }
  const imports = entries.map(({ identifier, path }) =>
    `import ${identifier.replace(/-/g, '_')} from '${path}'`,
  ).join('\n')
  const items = entries.map(entry => renderEntry(entry, options)).join(',\n  ')
  return `${imports}\n\nexport const ${exportName} = [\n  ${items}\n]\n`
}

/**
 * A discovered named-handler directory (`<mcpDir>/handlers/<name>/`).
 * Carries enough info to scan its `tools/`, `resources/`, `prompts/` subtrees
 * and tag every file with `handler: name`.
 */
export interface DiscoveredHandlerDir {
  /** Handler name, derived from the directory name. */
  name: string
  /** Path relative to the layer's server dir (e.g. `mcp/handlers/admin`). */
  basePath: string
  /** Layer this handler dir belongs to. */
  layerServer: string
}

/**
 * Glob `<layer.server>/<mcpBasePath>/handlers/*` across every layer and return
 * the discovered named-handler directories. Used to wire up folder-convention
 * attribution: any tool/resource/prompt placed under
 * `mcp/handlers/<name>/{tools,resources,prompts}/` is auto-tagged with
 * `_meta.handler = '<name>'` and the matching `index.ts` (if any) is loaded
 * as the handler config.
 */
export async function discoverHandlerDirs(mcpBasePaths: string[]): Promise<DiscoveredHandlerDir[]> {
  if (mcpBasePaths.length === 0) return []
  const layerDirectories = getLayerDirectories()
  const discovered: DiscoveredHandlerDir[] = []
  const seen = new Set<string>()

  for (const layer of layerDirectories) {
    for (const basePath of mcpBasePaths) {
      const pattern = normalizePath(resolvePath(layer.server, `${basePath}/handlers/*`))
      const dirs = await glob(pattern, { absolute: true, onlyDirectories: true })
      for (const absolutePath of dirs) {
        // tinyglobby may include a trailing slash on directory matches.
        const name = absolutePath.replace(/\\/g, '/').replace(/\/$/, '').split('/').pop()
        if (!name) continue
        const key = `${layer.server}::${name}`
        if (seen.has(key)) continue
        seen.add(key)
        discovered.push({
          name,
          basePath: `${basePath}/handlers/${name}`,
          layerServer: layer.server,
        })
      }
    }
  }
  return discovered
}

/**
 * Find the highest-priority `index.{ts,js,mts,mjs}` for the given paths
 * (main app overrides extended layers).
 */
export async function findIndexFile(paths: string[], extensions = ['ts', 'js', 'mts', 'mjs']): Promise<string | null> {
  if (paths.length === 0) return null
  const layerDirectories = getLayerDirectories()
  for (const layer of layerDirectories) {
    const indexPatterns = paths.flatMap(pathPattern =>
      extensions.map(ext => normalizePath(resolvePath(layer.server, `${pathPattern}/index.${ext}`))),
    )
    const indexFiles = await glob(indexPatterns, { absolute: true, onlyFiles: true })
    if (indexFiles.length > 0) return indexFiles[0]!
  }
  return null
}

/** Compute relative path inside a base dir, extracting the subdirectory as `group`. */
function computeRelativeInfo(filePath: string, layerServer: string, basePath: string): { relativePath: string, group?: string } {
  const baseDir = normalizePath(resolvePath(layerServer, basePath))
  const rel = normalizePath(relativePath(baseDir, filePath))
  if (rel.startsWith('..')) {
    return { relativePath: normalizePath(filePath).split('/').pop()! }
  }
  const parts = rel.split('/')
  if (parts.length > 1) {
    return { relativePath: rel, group: parts.slice(0, -1).join('/') }
  }
  return { relativePath: rel }
}

/**
 * Scan one or more roots for definition files across every Nuxt layer. Files
 * found under a root tagged with `handler` are auto-attributed (their loaded
 * representation gets `handler` set, which surfaces as `_meta.handler` later).
 *
 * Layers are processed in reverse order (extended layers first, app last) so
 * the main app can override definitions from extended layers based on the
 * generated identifier.
 */
export async function loadDefinitionFiles(
  roots: ScanRoot[],
  options: {
    excludePatterns?: string[]
    filter?: (filePath: string) => boolean
    recursive?: boolean
  } = {},
): Promise<LoadResult> {
  if (roots.length === 0) return { count: 0, files: [], overriddenCount: 0 }

  const layerDirectories = getLayerDirectories()
  const reversedLayers = [...layerDirectories].reverse()

  const definitionsMap = new Map<string, LoadedFile>()
  let overriddenCount = 0

  for (const layer of reversedLayers) {
    for (const root of roots) {
      const patterns = createLayerFilePatterns(layer.server, [root.path], undefined, options.recursive)
      const files = await glob(patterns, {
        absolute: true,
        onlyFiles: true,
        ignore: [...(options.excludePatterns || []), '**/*.d.ts'],
      })
      const filtered = options.filter ? files.filter(options.filter) : files

      for (const filePath of filtered) {
        const { relativePath, group } = computeRelativeInfo(filePath, layer.server, root.path)
        // Prefix the identifier when this entry is attributed to a named
        // handler so identical basenames across handlers don't collide.
        const baseId = toIdentifier(relativePath)
        const identifier = root.handler
          ? toIdentifier(`handlers/${root.handler}/${relativePath}`)
          : baseId
        if (definitionsMap.has(identifier)) overriddenCount++
        definitionsMap.set(identifier, {
          path: filePath,
          group,
          ...(root.handler ? { handler: root.handler } : {}),
        })
      }
    }
  }

  return {
    count: definitionsMap.size,
    files: Array.from(definitionsMap.values()),
    overriddenCount,
  }
}
