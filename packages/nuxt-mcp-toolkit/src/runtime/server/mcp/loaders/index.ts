import { addServerTemplate, logger } from '@nuxt/kit'
import {
  createExcludePatterns,
  createTemplateContent,
  discoverHandlerDirs,
  findIndexFile,
  loadDefinitionFiles,
  toIdentifier,
  type DiscoveredHandlerDir,
  type LoadResult,
  type LoadedFile,
  type ScanRoot,
  type TemplateEntry,
} from './utils'

const log = logger.withTag('@nuxtjs/mcp-toolkit')

export interface LoaderPaths {
  tools: string[]
  resources: string[]
  prompts: string[]
  handlers?: string[]
}

export interface HandlerRouteInfo {
  name: string
  route?: string
}

interface LoadResults {
  tools: LoadResult
  resources: LoadResult
  prompts: LoadResult
  handlers: LoadResult
  hasDefaultHandler: boolean
  /** Number of named-handler dirs discovered under `mcp/handlers/*`. */
  namedHandlerDirs: number
}

function fileToTemplateEntry(file: LoadedFile): TemplateEntry {
  const filename = file.path.replace(/\\/g, '/').split('/').pop()!
  const relativePath = file.group ? `${file.group}/${filename}` : filename
  const baseId = toIdentifier(relativePath)
  const identifier = file.handler
    ? toIdentifier(`handlers/${file.handler}/${relativePath}`)
    : baseId
  return { identifier, path: file.path, group: file.group, handler: file.handler }
}

/**
 * Warn when two definition files in different subdirectories share the same
 * basename, which would produce the same auto-generated name and silently
 * overwrite each other at registration time. Files attributed to different
 * handlers are exempt — they live in distinct handler scopes.
 */
function warnOnNameCollisions(type: string, files: LoadedFile[]) {
  const byBasename = new Map<string, LoadedFile[]>()
  for (const file of files) {
    const basename = file.path.replace(/\\/g, '/').split('/').pop()!
    const key = `${file.handler ?? ''}::${basename}`
    const existing = byBasename.get(key)
    if (existing) existing.push(file)
    else byBasename.set(key, [file])
  }
  for (const [, entries] of byBasename) {
    if (entries.length < 2) continue
    const basename = entries[0]!.path.replace(/\\/g, '/').split('/').pop()!
    const paths = entries.map(e => e.group ? `${e.group}/${basename}` : basename)
    log.warn(
      `Multiple ${type} files share the basename "${basename}" (${paths.join(', ')}). `
      + `Set an explicit \`name\` on each definition to avoid collisions.`,
    )
  }
}

/**
 * Build scan roots for a definition kind: the user-provided base paths plus
 * one tagged root per discovered named-handler dir (`handlers/<name>/<kind>`).
 */
function buildScanRoots(
  basePaths: string[],
  handlerDirs: DiscoveredHandlerDir[],
  kind: 'tools' | 'resources' | 'prompts',
): ScanRoot[] {
  return [
    ...basePaths.map(path => ({ path })),
    ...handlerDirs.map(dir => ({ path: `${dir.basePath}/${kind}`, handler: dir.name })),
  ]
}

async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
  basePaths: string[],
  handlerDirs: DiscoveredHandlerDir[],
  extraFiles: LoadedFile[] = [],
): Promise<LoadResult> {
  try {
    const roots = buildScanRoots(basePaths, handlerDirs, type)
    const result = await loadDefinitionFiles(roots, { recursive: true })
    warnOnNameCollisions(type, result.files)

    const allFiles = [...result.files, ...extraFiles]

    addServerTemplate({
      filename: templateFilename,
      getContents: () => createTemplateContent(type, allFiles.map(fileToTemplateEntry)),
    })

    return { ...result, count: allFiles.length, files: allFiles }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load ${type} definitions from paths: ${basePaths.join(', ')}`)
    log.error(`Error: ${message}`)
    throw new Error(`Failed to load MCP ${type} definitions. Check that the paths exist and contain valid definition files.`)
  }
}

/**
 * Load handler config files: top-level files (`mcp/<name>.ts`, back-compat) and
 * folder-handler index files (`mcp/handlers/<name>/index.ts`). Folder handlers
 * are tagged with `handler: <name>` so the runtime can distinguish them from
 * top-level ones (folder handlers default to attribution-filtered tools, while
 * top-level handlers default to the full tool pool).
 */
async function loadHandlers(paths: string[] = [], handlerDirs: DiscoveredHandlerDir[] = []): Promise<LoadResult> {
  if (paths.length === 0 && handlerDirs.length === 0) {
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/handlers.mjs',
      getContents: () => `export const handlers = []\n`,
    })
    return { count: 0, files: [], overriddenCount: 0 }
  }

  try {
    const topLevel = paths.length > 0
      ? await loadDefinitionFiles(paths.map(path => ({ path })), {
          excludePatterns: createExcludePatterns(paths, ['tools', 'resources', 'prompts', 'handlers']),
          filter: (filePath) => {
            const relativePath = filePath.replace(/.*\/server\//, '')
            const filename = filePath.split('/').pop()!
            const isIndexFile = /^index\.(?:ts|js|mts|mjs)$/.test(filename)
            return !relativePath.includes('/tools/')
              && !relativePath.includes('/resources/')
              && !relativePath.includes('/prompts/')
              && !relativePath.includes('/handlers/')
              && !isIndexFile
          },
        })
      : { count: 0, files: [] as LoadedFile[], overriddenCount: 0 }

    const folderEntries: TemplateEntry[] = []
    let folderCount = 0
    for (const dir of handlerDirs) {
      const indexFile = await findIndexFile([dir.basePath])
      if (!indexFile) {
        log.warn(
          `Handler dir "${dir.basePath}" has no index file. `
          + `Add \`export default defineMcpHandler({})\` to register the /<route>/${dir.name} route.`,
        )
        continue
      }
      folderEntries.push({
        identifier: toIdentifier(`handlers/${dir.name}/index`),
        path: indexFile,
        handler: dir.name,
      })
      folderCount++
    }

    const allEntries = [...topLevel.files.map(fileToTemplateEntry), ...folderEntries]

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/handlers.mjs',
      getContents: () => createTemplateContent('handlers', allEntries, {
        // Folder handlers always derive their `name` from the directory,
        // overriding whatever the user wrote in the file.
        nameOverride: e => e.handler,
      }),
    })

    return {
      count: topLevel.files.length + folderCount,
      files: topLevel.files,
      overriddenCount: topLevel.overriddenCount,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load handler definitions from paths: ${paths.join(', ')}`)
    log.error(`Error: ${message}`)
    throw new Error(`Failed to load MCP handler definitions. Check that the paths exist and contain valid handler files.`)
  }
}

export async function loadTools(basePaths: string[], handlerDirs: DiscoveredHandlerDir[] = [], extraFiles: LoadedFile[] = []) {
  return loadMcpDefinitions('tools', '#nuxt-mcp-toolkit/tools.mjs', basePaths, handlerDirs, extraFiles)
}

export async function loadResources(basePaths: string[], handlerDirs: DiscoveredHandlerDir[] = [], extraFiles: LoadedFile[] = []) {
  return loadMcpDefinitions('resources', '#nuxt-mcp-toolkit/resources.mjs', basePaths, handlerDirs, extraFiles)
}

export async function loadPrompts(basePaths: string[], handlerDirs: DiscoveredHandlerDir[] = []) {
  return loadMcpDefinitions('prompts', '#nuxt-mcp-toolkit/prompts.mjs', basePaths, handlerDirs)
}

export { loadHandlers }

/**
 * Load the default handler from `mcp/index.ts` if it exists. Lets users
 * override the default `/mcp` route configuration.
 */
async function loadDefaultHandler(paths: string[] = []): Promise<boolean> {
  try {
    const indexFile = await findIndexFile(paths)
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/default-handler.mjs',
      getContents: () => indexFile
        ? `import handler from '${indexFile}'\nexport const defaultHandler = handler\n`
        : `export const defaultHandler = null\n`,
    })
    return indexFile !== null
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load default handler: ${message}`)
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/default-handler.mjs',
      getContents: () => `export const defaultHandler = null\n`,
    })
    return false
  }
}

export interface LoaderExtras {
  toolFiles?: LoadedFile[]
  resourceFiles?: LoadedFile[]
}

export async function loadAllDefinitions(paths: LoaderPaths, extras: LoaderExtras = {}) {
  try {
    const handlerDirs = await discoverHandlerDirs(paths.handlers ?? [])

    const [tools, resources, prompts, handlers, hasDefaultHandler] = await Promise.all([
      loadTools(paths.tools, handlerDirs, extras.toolFiles),
      loadResources(paths.resources, handlerDirs, extras.resourceFiles),
      loadPrompts(paths.prompts, handlerDirs),
      loadHandlers(paths.handlers ?? [], handlerDirs),
      loadDefaultHandler(paths.handlers ?? []),
    ])

    const results: LoadResults = {
      tools, resources, prompts, handlers, hasDefaultHandler,
      namedHandlerDirs: handlerDirs.length,
    }

    return {
      ...results,
      total: tools.count + resources.count + prompts.count + handlers.count,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('Failed to load MCP definitions')
    log.error(`Error: ${message}`)
    throw new Error('Failed to load MCP definitions. Please check your configuration and ensure definition files are valid.')
  }
}

/**
 * Read handler route info at runtime — used by inspectors and devtools to map
 * handler names to routes.
 */
export async function getHandlerRoutes(): Promise<HandlerRouteInfo[]> {
  try {
    const { handlers } = await import('#nuxt-mcp-toolkit/handlers.mjs')
    return handlers.map(h => ({ name: h.name ?? '', route: h.route }))
  }
  catch {
    return []
  }
}
