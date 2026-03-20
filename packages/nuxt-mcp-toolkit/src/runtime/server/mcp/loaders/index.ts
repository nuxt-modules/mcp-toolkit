import { addServerTemplate, logger } from '@nuxt/kit'
import {
  createExcludePatterns,
  createTemplateContent,
  findIndexFile,
  loadDefinitionFiles,
  toIdentifier,
  type LoadResult,
  type LoadedFile,
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
}

function fileToTemplateEntry(file: LoadedFile): TemplateEntry {
  const parts = file.path.replace(/\\/g, '/').split('/')
  const filename = parts.pop()!
  const relativePath = file.group ? `${file.group}/${filename}` : filename
  return {
    identifier: toIdentifier(relativePath),
    path: file.path,
    group: file.group,
  }
}

/**
 * Warn when two definition files in different subdirectories share the same
 * basename, which would produce the same auto-generated name and cause one
 * to silently overwrite the other at registration time.
 */
function warnOnNameCollisions(type: string, files: LoadedFile[]) {
  const byBasename = new Map<string, LoadedFile[]>()
  for (const file of files) {
    const basename = file.path.replace(/\\/g, '/').split('/').pop()!
    const existing = byBasename.get(basename)
    if (existing) {
      existing.push(file)
    }
    else {
      byBasename.set(basename, [file])
    }
  }
  for (const [basename, entries] of byBasename) {
    if (entries.length > 1) {
      const paths = entries.map(e => e.group ? `${e.group}/${basename}` : basename)
      log.warn(
        `Multiple ${type} files share the basename "${basename}" (${paths.join(', ')}). `
        + `Set an explicit \`name\` on each definition to avoid collisions.`,
      )
    }
  }
}

async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
  paths: string[],
): Promise<LoadResult> {
  try {
    const result = await loadDefinitionFiles(paths, { recursive: true })

    warnOnNameCollisions(type, result.files)

    // Always generate the template file, even if empty (for imports)
    addServerTemplate({
      filename: templateFilename,
      getContents: () => {
        if (result.count === 0) {
          return `export const ${type} = []\n`
        }
        const entries = result.files.map(fileToTemplateEntry)
        return createTemplateContent(type, entries)
      },
    })

    return result
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load ${type} definitions from paths: ${paths.join(', ')}`)
    log.error(`Error: ${errorMessage}`)
    throw new Error(`Failed to load MCP ${type} definitions. Check that the paths exist and contain valid definition files.`)
  }
}

async function loadHandlers(paths: string[] = []): Promise<LoadResult> {
  try {
    if (paths.length === 0) {
      // Always generate handlers file, even if empty (for imports)
      addServerTemplate({
        filename: '#nuxt-mcp-toolkit/handlers.mjs',
        getContents: () => `export const handlers = []\n`,
      })
      return { count: 0, files: [], overriddenCount: 0 }
    }

    const excludePatterns = createExcludePatterns(paths, ['tools', 'resources', 'prompts'])
    const result = await loadDefinitionFiles(paths, {
      excludePatterns,
      filter: (filePath) => {
        const relativePath = filePath.replace(/.*\/server\//, '')
        const filename = filePath.split('/').pop()!
        const isIndexFile = /^index\.(?:ts|js|mts|mjs)$/.test(filename)
        return !relativePath.includes('/tools/')
          && !relativePath.includes('/resources/')
          && !relativePath.includes('/prompts/')
          && !isIndexFile
      },
    })

    // Always generate the template file, even if empty (for imports)
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/handlers.mjs',
      getContents: () => {
        if (result.count === 0) {
          return `export const handlers = []\n`
        }
        const entries = result.files.map(fileToTemplateEntry)
        return createTemplateContent('handlers', entries)
      },
    })

    return result
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load handler definitions from paths: ${paths.join(', ')}`)
    log.error(`Error: ${errorMessage}`)
    throw new Error(`Failed to load MCP handler definitions. Check that the paths exist and contain valid handler files.`)
  }
}

export async function loadTools(paths: string[]) {
  return loadMcpDefinitions('tools', '#nuxt-mcp-toolkit/tools.mjs', paths)
}

export async function loadResources(paths: string[]) {
  return loadMcpDefinitions('resources', '#nuxt-mcp-toolkit/resources.mjs', paths)
}

export async function loadPrompts(paths: string[]) {
  return loadMcpDefinitions('prompts', '#nuxt-mcp-toolkit/prompts.mjs', paths)
}

export { loadHandlers }

/**
 * Load the default handler from index.ts file if it exists
 * This allows users to override the default /mcp handler configuration
 */
async function loadDefaultHandler(paths: string[] = []): Promise<boolean> {
  try {
    const indexFile = await findIndexFile(paths)

    // Always generate the template file
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/default-handler.mjs',
      getContents: () => {
        if (!indexFile) {
          return `export const defaultHandler = null\n`
        }
        return `import handler from '${indexFile}'\nexport const defaultHandler = handler\n`
      },
    })

    return indexFile !== null
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load default handler: ${errorMessage}`)
    // Generate empty template on error
    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/default-handler.mjs',
      getContents: () => `export const defaultHandler = null\n`,
    })
    return false
  }
}

export async function loadAllDefinitions(paths: LoaderPaths) {
  try {
    const [tools, resources, prompts, handlers, hasDefaultHandler] = await Promise.all([
      loadTools(paths.tools),
      loadResources(paths.resources),
      loadPrompts(paths.prompts),
      loadHandlers(paths.handlers ?? []),
      loadDefaultHandler(paths.handlers ?? []),
    ])

    const results: LoadResults = {
      tools,
      resources,
      prompts,
      handlers,
      hasDefaultHandler,
    }

    return {
      ...results,
      total: tools.count + resources.count + prompts.count + handlers.count,
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error('Failed to load MCP definitions')
    log.error(`Error: ${errorMessage}`)
    throw new Error('Failed to load MCP definitions. Please check your configuration and ensure definition files are valid.')
  }
}

/**
 * Get handler route information from loaded handlers
 * This is used at runtime to identify handlers by their routes
 */
export async function getHandlerRoutes(): Promise<HandlerRouteInfo[]> {
  try {
    // @ts-expect-error - Generated module, types available at runtime
    const handlersModule = await import('#nuxt-mcp-toolkit/handlers.mjs')
    interface HandlerDef {
      name: string
      route?: string
    }
    const handlers = handlersModule.handlers as HandlerDef[]
    return handlers.map(h => ({ name: h.name, route: h.route }))
  }
  catch {
    return []
  }
}
