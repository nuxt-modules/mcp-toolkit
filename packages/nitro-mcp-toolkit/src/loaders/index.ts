import type { Nitro } from 'nitropack'
import {
  createExcludePatterns,
  createTemplateContent,
  findIndexFile,
  loadDefinitionFiles,
  toIdentifier,
  type LoadResult,
} from './utils'

export interface LoaderPaths {
  tools: string[]
  resources: string[]
  prompts: string[]
  handlers?: string[]
}

interface LoadResults {
  tools: LoadResult
  resources: LoadResult
  prompts: LoadResult
  handlers: LoadResult
  hasDefaultHandler: boolean
}

/**
 * Get directories to scan for MCP definitions
 * Uses scanDirs if available, otherwise falls back to srcDir/server
 */
function getMcpScanDirs(nitro: Nitro): string[] {
  const dirs: string[] = []

  // Add srcDir/server as primary location for MCP definitions
  if (nitro.options.srcDir) {
    dirs.push(`${nitro.options.srcDir}/server`)
  }

  // Also check scanDirs for Nuxt compatibility
  if (nitro.options.scanDirs?.length) {
    dirs.push(...nitro.options.scanDirs)
  }

  // Deduplicate
  return [...new Set(dirs)]
}

/**
 * Load MCP definitions and register virtual modules with Nitro
 */
async function loadMcpDefinitions(
  nitro: Nitro,
  type: 'tools' | 'resources' | 'prompts',
  virtualModuleName: string,
  paths: string[],
): Promise<LoadResult> {
  const scanDirs = getMcpScanDirs(nitro)

  const result = await loadDefinitionFiles(scanDirs, paths)

  // Register virtual module
  nitro.options.virtual[virtualModuleName] = () => {
    if (result.count === 0) {
      return `export const ${type} = []\n`
    }
    const entries = result.files.map((file) => {
      const filename = file.split('/').pop()!
      const identifier = toIdentifier(filename)
      return [identifier, file] as [string, string]
    })
    return createTemplateContent(type, entries)
  }

  return result
}

/**
 * Load handler definitions
 */
async function loadHandlers(
  nitro: Nitro,
  paths: string[] = [],
): Promise<LoadResult> {
  if (paths.length === 0) {
    // Always generate handlers module, even if empty
    nitro.options.virtual['#mcp/handlers'] = () => `export const handlers = []\n`
    return { count: 0, files: [], overriddenCount: 0 }
  }

  const scanDirs = getMcpScanDirs(nitro)
  const excludePatterns = createExcludePatterns(scanDirs, paths, ['tools', 'resources', 'prompts'])

  const result = await loadDefinitionFiles(scanDirs, paths, {
    excludePatterns,
    filter: (filePath) => {
      const relativePath = filePath.replace(/.*\/server\//, '')
      const filename = filePath.split('/').pop()!
      // Exclude index files (they are used as default handler override)
      const isIndexFile = /^index\.(?:ts|js|mts|mjs)$/.test(filename)
      return !relativePath.includes('/tools/')
        && !relativePath.includes('/resources/')
        && !relativePath.includes('/prompts/')
        && !isIndexFile
    },
  })

  // Register virtual module
  nitro.options.virtual['#mcp/handlers'] = () => {
    if (result.count === 0) {
      return `export const handlers = []\n`
    }
    const entries = result.files.map((file) => {
      const filename = file.split('/').pop()!
      const identifier = toIdentifier(filename)
      return [identifier, file] as [string, string]
    })
    return createTemplateContent('handlers', entries)
  }

  return result
}

/**
 * Load the default handler from index.ts file if it exists
 */
async function loadDefaultHandler(
  nitro: Nitro,
  paths: string[] = [],
): Promise<boolean> {
  const scanDirs = getMcpScanDirs(nitro)
  const indexFile = await findIndexFile(scanDirs, paths)

  // Register virtual module
  nitro.options.virtual['#mcp/default-handler'] = () => {
    if (!indexFile) {
      return `export const defaultHandler = null\n`
    }
    return `import handler from '${indexFile}'\nexport const defaultHandler = handler\n`
  }

  return indexFile !== null
}

export async function loadTools(nitro: Nitro, paths: string[]) {
  return loadMcpDefinitions(nitro, 'tools', '#mcp/tools', paths)
}

export async function loadResources(nitro: Nitro, paths: string[]) {
  return loadMcpDefinitions(nitro, 'resources', '#mcp/resources', paths)
}

export async function loadPrompts(nitro: Nitro, paths: string[]) {
  return loadMcpDefinitions(nitro, 'prompts', '#mcp/prompts', paths)
}

export { loadHandlers }

export async function loadAllDefinitions(nitro: Nitro, paths: LoaderPaths) {
  const [tools, resources, prompts, handlers, hasDefaultHandler] = await Promise.all([
    loadTools(nitro, paths.tools),
    loadResources(nitro, paths.resources),
    loadPrompts(nitro, paths.prompts),
    loadHandlers(nitro, paths.handlers ?? []),
    loadDefaultHandler(nitro, paths.handlers ?? []),
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

export * from './utils'
