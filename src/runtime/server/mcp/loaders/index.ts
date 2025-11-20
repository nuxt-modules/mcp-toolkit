import { addServerTemplate, logger } from '@nuxt/kit'
import {
  createExcludePatterns,
  createTemplateContent,
  loadDefinitionFiles,
  toIdentifier,
  type LoadResult,
} from './utils'

const log = logger.withTag('nuxt-mcp-toolkit')

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
}

async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
  paths: string[],
): Promise<LoadResult> {
  try {
    const result = await loadDefinitionFiles(paths)

    // Always generate the template file, even if empty (for imports)
    addServerTemplate({
      filename: templateFilename,
      getContents: () => {
        if (result.count === 0) {
          return `export const ${type} = []\n`
        }
        const entries = result.files.map((file) => {
          const filename = file.split('/').pop()!
          const identifier = toIdentifier(filename)
          return [identifier, file] as [string, string]
        })
        return createTemplateContent(type, entries)
      },
    })

    return result
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load ${type} definitions from paths: ${paths.join(', ')}`)
    log.error(`Error: ${errorMessage}`)
    throw new Error(
      `Failed to load MCP ${type} definitions. Check that the paths exist and contain valid definition files.`,
      { cause: error },
    )
  }
}

async function loadHandlers(paths: string[] = []): Promise<LoadResult> {
  try {
    if (paths.length === 0) {
      // Always generate handlers file, even if empty (for imports)
      addServerTemplate({
        filename: '#nuxt-mcp/handlers.mjs',
        getContents: () => `export const handlers = []\n`,
      })
      return { count: 0, files: [], overriddenCount: 0 }
    }

    const excludePatterns = createExcludePatterns(paths, ['tools', 'resources', 'prompts'])
    const result = await loadDefinitionFiles(paths, {
      excludePatterns,
      filter: (filePath) => {
        const relativePath = filePath.replace(/.*\/server\//, '')
        return !relativePath.includes('/tools/')
          && !relativePath.includes('/resources/')
          && !relativePath.includes('/prompts/')
      },
    })

    // Always generate the template file, even if empty (for imports)
    addServerTemplate({
      filename: '#nuxt-mcp/handlers.mjs',
      getContents: () => {
        if (result.count === 0) {
          return `export const handlers = []\n`
        }
        const entries = result.files.map((file) => {
          const filename = file.split('/').pop()!
          const identifier = toIdentifier(filename)
          return [identifier, file] as [string, string]
        })
        return createTemplateContent('handlers', entries)
      },
    })

    return result
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log.error(`Failed to load handler definitions from paths: ${paths.join(', ')}`)
    log.error(`Error: ${errorMessage}`)
    throw new Error(
      `Failed to load MCP handler definitions. Check that the paths exist and contain valid handler files.`,
      { cause: error },
    )
  }
}

export async function loadTools(paths: string[]) {
  return loadMcpDefinitions('tools', '#nuxt-mcp/tools.mjs', paths)
}

export async function loadResources(paths: string[]) {
  return loadMcpDefinitions('resources', '#nuxt-mcp/resources.mjs', paths)
}

export async function loadPrompts(paths: string[]) {
  return loadMcpDefinitions('prompts', '#nuxt-mcp/prompts.mjs', paths)
}

export { loadHandlers }

export async function loadAllDefinitions(paths: LoaderPaths) {
  try {
    const [tools, resources, prompts, handlers] = await Promise.all([
      loadTools(paths.tools),
      loadResources(paths.resources),
      loadPrompts(paths.prompts),
      loadHandlers(paths.handlers ?? []),
    ])

    const results: LoadResults = {
      tools,
      resources,
      prompts,
      handlers,
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
    throw new Error(
      'Failed to load MCP definitions. Please check your configuration and ensure definition files are valid.',
      { cause: error },
    )
  }
}

/**
 * Get handler route information from loaded handlers
 * This is used at runtime to identify handlers by their routes
 */
export async function getHandlerRoutes(): Promise<HandlerRouteInfo[]> {
  try {
    // @ts-expect-error - Generated module, types available at runtime
    const handlersModule = await import('#nuxt-mcp/handlers.mjs')
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
