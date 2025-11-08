import { defineNuxtModule, addServerHandler, createResolver, addServerImports, logger, getLayerDirectories, addServerTemplate } from '@nuxt/kit'
import { defu } from 'defu'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'

const log = logger.withTag('docus:mcp')

export const { resolve } = createResolver(import.meta.url)

export interface ModuleOptions {
  /**
   * Enable or disable the MCP server
   * @default true
   */
  enabled?: boolean
  /**
   * The route path for the MCP server endpoint
   * @default '/mcp'
   */
  route?: string
  /**
   * URL to redirect to when a browser accesses the MCP endpoint
   * @default '/'
   */
  redirectTo?: string
  /**
   * The name of the MCP server
   * @default Site name from site config or 'Docus Documentation'
   */
  name?: string
  /**
   * The version of the MCP server
   * @default '1.0.0'
   */
  version?: string
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'docus-mcp',
    configKey: 'mcp',
  },
  defaults: {
    enabled: true,
    route: '/mcp',
    redirectTo: '/',
    name: '',
    version: '1.0.0',
  },
  async setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.mcp = defu(
      nuxt.options.runtimeConfig.mcp,
      {
        enabled: options.enabled,
        route: options.route,
        redirectTo: options.redirectTo,
        name: options.name,
        version: options.version,
      },
    )

    if (!options.enabled) {
      log.info('MCP server is disabled')
      return
    }

    log.info(`MCP server enabled at route: ${options.route}`)

    await loadTools()

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({
        path: resolver.resolve('./runtime/server/types.server.d.ts'),
      })
    })

    nuxt.options.nitro.typescript ??= {}
    nuxt.options.nitro.typescript.tsConfig ??= {}
    nuxt.options.nitro.typescript.tsConfig.include ??= []
    nuxt.options.nitro.typescript.tsConfig.include.push(resolver.resolve('./runtime/server/types.server.d.ts'))

    addServerImports([
      {
        name: 'defineMcpTool',
        from: resolver.resolve('runtime/server/utils/mcp'),
      },
    ])

    // addServerHandler({
    //   route: '/.docus-mcp/list-pages',
    //   handler: resolve('runtime/server/api/list-pages.get.ts'),
    // })

    // addServerHandler({
    //   route: '/.docus-mcp/get-page',
    //   handler: resolve('runtime/server/api/get-page.get.ts'),
    // })

    addServerHandler({
      route: options.route,
      handler: resolver.resolve('runtime/server/mcp/handler.ts'),
    })
  },
})

async function loadTools() {
  const layerDirectories = getLayerDirectories()
  const toolPatterns = layerDirectories.map(layer => [
    resolvePath(layer.server, 'mcp/tools/*.ts'),
    resolvePath(layer.server, 'mcp/tools/*.js'),
    resolvePath(layer.server, 'mcp/tools/*.mts'),
    resolvePath(layer.server, 'mcp/tools/*.mjs'),
  ]).flat()

  const layerTools = await glob(toolPatterns, { absolute: true, onlyFiles: true })

  const toolsMap = new Map<string, string>()

  const toIdentifier = (filename: string) => {
    return filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/\W/g, '_')
  }

  for (const toolPath of layerTools) {
    const filename = toolPath.split('/').pop()!
    const identifier = toIdentifier(filename)
    if (toolsMap.has(identifier)) {
      log.info(`Tool "${identifier}" overridden by project/layer version`)
    }
    toolsMap.set(identifier, toolPath)
  }

  const totalTools = toolsMap.size
  const overriddenCount = layerTools.length - totalTools

  if (overriddenCount > 0) {
    log.info(`Found ${totalTools} MCP tool(s) (${layerTools.length} from layers, ${overriddenCount} overridden)`)
  }
  else {
    log.info(`Found ${totalTools} MCP tool(s) (${layerTools.length} from layers)`)
  }

  addServerTemplate({
    filename: '#nuxt-mcp/tools.mjs',
    getContents: () => {
      const entries = Array.from(toolsMap.entries())
      const imports = entries.map(([name, path]) =>
        `import ${name.replace(/-/g, '_')} from '${path}'`,
      ).join('\n')
      const exports = entries.map(([name]) => name.replace(/-/g, '_')).join(', ')
      return `${imports}\n\nexport const tools = [${exports}]\n`
    },
  })
}
