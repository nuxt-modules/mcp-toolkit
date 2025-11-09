import { getLayerDirectories, addServerTemplate, logger } from '@nuxt/kit'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'

const log = logger.withTag('nuxt-mcp')

/**
 * Generic loader for MCP definitions (tools, resources, prompts)
 */
async function loadMcpDefinitions(
  type: 'tools' | 'resources' | 'prompts',
  templateFilename: string,
) {
  const layerDirectories = getLayerDirectories()
  const patterns = layerDirectories.map(layer => [
    resolvePath(layer.server, `mcp/${type}/*.ts`),
    resolvePath(layer.server, `mcp/${type}/*.js`),
    resolvePath(layer.server, `mcp/${type}/*.mts`),
    resolvePath(layer.server, `mcp/${type}/*.mjs`),
  ]).flat()

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

/**
 * Load all MCP tools from server/mcp/tools/
 */
export async function loadTools() {
  return loadMcpDefinitions('tools', '#nuxt-mcp/tools.mjs')
}

/**
 * Load all MCP resources from server/mcp/resources/
 */
export async function loadResources() {
  return loadMcpDefinitions('resources', '#nuxt-mcp/resources.mjs')
}

/**
 * Load all MCP prompts from server/mcp/prompts/
 */
export async function loadPrompts() {
  return loadMcpDefinitions('prompts', '#nuxt-mcp/prompts.mjs')
}

/**
 * Load all MCP definitions (tools, resources, prompts)
 */
export async function loadAllDefinitions() {
  const [tools, resources, prompts] = await Promise.all([
    loadTools(),
    loadResources(),
    loadPrompts(),
  ])

  return {
    tools,
    resources,
    prompts,
    total: tools.count + resources.count + prompts.count,
  }
}
