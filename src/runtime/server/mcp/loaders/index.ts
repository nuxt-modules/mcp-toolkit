import { getLayerDirectories, addServerTemplate, logger } from '@nuxt/kit'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'

const log = logger.withTag('nuxt-mcp')

/**
 * Generic loader for MCP definitions (tools, resources, prompts)
 * Supports multiple paths per type (from hook extensions)
 */
async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
  paths: string[],
) {
  const layerDirectories = getLayerDirectories()
  const patterns = layerDirectories.flatMap(layer =>
    paths.flatMap(pathPattern => [
      resolvePath(layer.server, `${pathPattern}/*.ts`),
      resolvePath(layer.server, `${pathPattern}/*.js`),
      resolvePath(layer.server, `${pathPattern}/*.mts`),
      resolvePath(layer.server, `${pathPattern}/*.mjs`),
    ]),
  )

  const files = await glob(patterns, { absolute: true, onlyFiles: true })

  const definitionsMap = new Map<string, string>()

  const toIdentifier = (filename: string) => {
    return filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/\W/g, '_')
  }

  for (const filePath of files) {
    const filename = filePath.split('/').pop()!
    const identifier = toIdentifier(filename)
    if (definitionsMap.has(identifier)) {
      log.info(`${type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1)} "${identifier}" overridden by project/layer version`)
    }
    definitionsMap.set(identifier, filePath)
  }

  const total = definitionsMap.size
  const overriddenCount = files.length - total

  if (overriddenCount > 0) {
    log.info(`Found ${total} MCP ${type} (${files.length} files, ${overriddenCount} overridden)`)
  }
  else {
    log.info(`Found ${total} MCP ${type} (${files.length} files)`)
  }

  addServerTemplate({
    filename: templateFilename,
    getContents: () => {
      const entries = Array.from(definitionsMap.entries())
      const imports = entries.map(([name, path]) =>
        `import ${name.replace(/-/g, '_')} from '${path}'`,
      ).join('\n')
      const exports = entries.map(([name]) => name.replace(/-/g, '_')).join(', ')
      return `${imports}\n\nexport const ${type} = [${exports}]\n`
    },
  })

  return { count: total, files: Array.from(definitionsMap.values()) }
}

export interface LoaderPaths {
  tools: string[]
  resources: string[]
  prompts: string[]
}

/**
 * Load all MCP tools from the specified paths
 */
export async function loadTools(paths: string[]) {
  return loadMcpDefinitions('tools', '#nuxt-mcp/tools.mjs', paths)
}

/**
 * Load all MCP resources from the specified paths
 */
export async function loadResources(paths: string[]) {
  return loadMcpDefinitions('resources', '#nuxt-mcp/resources.mjs', paths)
}

/**
 * Load all MCP prompts from the specified paths
 */
export async function loadPrompts(paths: string[]) {
  return loadMcpDefinitions('prompts', '#nuxt-mcp/prompts.mjs', paths)
}

/**
 * Load all MCP definitions (tools, resources, prompts)
 */
export async function loadAllDefinitions(paths: LoaderPaths) {
  const [tools, resources, prompts] = await Promise.all([
    loadTools(paths.tools),
    loadResources(paths.resources),
    loadPrompts(paths.prompts),
  ])

  return {
    tools,
    resources,
    prompts,
    total: tools.count + resources.count + prompts.count,
  }
}
