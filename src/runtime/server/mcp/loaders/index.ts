import { addServerTemplate, logger } from '@nuxt/kit'
import {
  createExcludePatterns,
  createTemplateContent,
  loadDefinitionFiles,
  toIdentifier,
  type LoadResult,
} from './utils'

const log = logger.withTag('nuxt-mcp')

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
}

function logLoadResults(results: LoadResults): void {
  const { tools, resources, prompts, handlers } = results
  const total = tools.count + resources.count + prompts.count + handlers.count

  if (total === 0) {
    return
  }

  const parts: string[] = []
  const addPart = (count: number, label: string, overridden?: number) => {
    if (count > 0) {
      const overriddenText = overridden && overridden > 0 ? ` (${overridden} overridden)` : ''
      parts.push(`${count} ${label}${overriddenText}`)
    }
  }

  addPart(tools.count, 'tools', tools.overriddenCount)
  addPart(resources.count, 'resources', resources.overriddenCount)
  addPart(prompts.count, 'prompts', prompts.overriddenCount)
  addPart(handlers.count, 'handlers', handlers.overriddenCount)

  log.info(`Found ${total} MCP definition${total > 1 ? 's' : ''}: ${parts.join(', ')}`)
}

async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
  paths: string[],
): Promise<LoadResult> {
  const result = await loadDefinitionFiles(paths)

  if (result.count > 0) {
    addServerTemplate({
      filename: templateFilename,
      getContents: () => {
        const entries = result.files.map((file) => {
          const filename = file.split('/').pop()!
          const identifier = toIdentifier(filename)
          return [identifier, file] as [string, string]
        })
        return createTemplateContent(type, entries)
      },
    })
  }

  return result
}

async function loadHandlers(paths: string[] = []): Promise<LoadResult> {
  if (paths.length === 0) {
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

  if (result.count > 0) {
    addServerTemplate({
      filename: '#nuxt-mcp/handlers.mjs',
      getContents: () => {
        const entries = result.files.map((file) => {
          const filename = file.split('/').pop()!
          const identifier = toIdentifier(filename)
          return [identifier, file] as [string, string]
        })
        return createTemplateContent('handlers', entries)
      },
    })
  }

  return result
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

  logLoadResults(results)

  return {
    ...results,
    total: tools.count + resources.count + prompts.count + handlers.count,
  }
}
