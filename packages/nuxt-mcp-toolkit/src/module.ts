import { defineNuxtModule, addServerHandler, addServerTemplate, createResolver, addServerImports, addComponent, logger, getLayerDirectories } from '@nuxt/kit'
import { defu } from 'defu'
import { resolve as resolvePath } from 'pathe'
import { glob } from 'tinyglobby'
import { defaultMcpConfig } from './runtime/server/mcp/config'
import { ROUTES } from './runtime/server/mcp/constants'
import { addDevToolsCustomTabs } from './runtime/server/mcp/devtools'
import { detectIDE, findInstalledMCPConfig, generateDeeplinkUrl, IDE_CONFIGS, terminalLink } from './utils/ide'
import { name, version } from '../package.json'

const log = logger.withTag('@nuxtjs/mcp-toolkit')

export const { resolve } = createResolver(import.meta.url)

export type * from './runtime/server/types'

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
  browserRedirect?: string
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
  /**
   * Base directory for MCP definitions relative to server directory
   * The module will look for tools, resources, and prompts in subdirectories
   * @default 'mcp'
   */
  dir?: string
}

// Internal types for loader results
interface LoadResult {
  count: number
  files: string[]
  overriddenCount: number
}

// Helper functions for loading definitions with Nuxt layers support
function createLayerFilePatterns(
  layerServer: string,
  paths: string[],
  extensions = ['ts', 'js', 'mts', 'mjs'],
): string[] {
  return paths.flatMap(pathPattern =>
    extensions.map(ext => resolvePath(layerServer, `${pathPattern}/*.${ext}`)),
  )
}

function toIdentifier(filename: string): string {
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
  const id = filename.replace(/\.(ts|js|mts|mjs)$/, '').replace(/\W/g, '_')
  if (RESERVED_KEYWORDS.has(id)) {
    return `_${id}`
  }
  return id
}

function createTemplateContent(
  type: string,
  entries: Array<[string, string]>,
): string {
  const imports = entries.map(([name, path]) =>
    `import ${name.replace(/-/g, '_')} from '${path}'`,
  ).join('\n')

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

async function loadDefinitionFilesWithLayers(
  paths: string[],
  options: {
    excludePatterns?: string[]
    filter?: (filePath: string) => boolean
  } = {},
): Promise<LoadResult> {
  if (paths.length === 0) {
    return { count: 0, files: [], overriddenCount: 0 }
  }

  const layerDirectories = getLayerDirectories()
  const reversedLayers = [...layerDirectories].reverse()

  const definitionsMap = new Map<string, string>()
  let overriddenCount = 0

  for (const layer of reversedLayers) {
    const layerPatterns = createLayerFilePatterns(layer.server, paths)
    const layerFiles = await glob(layerPatterns, {
      absolute: true,
      onlyFiles: true,
      ignore: [...(options.excludePatterns || []), '**/*.d.ts'],
    })

    const filteredFiles = options.filter ? layerFiles.filter(options.filter) : layerFiles

    for (const filePath of filteredFiles) {
      const filename = filePath.split('/').pop()!
      const identifier = toIdentifier(filename)
      if (definitionsMap.has(identifier)) {
        overriddenCount++
      }
      definitionsMap.set(identifier, filePath)
    }
  }

  return {
    count: definitionsMap.size,
    files: Array.from(definitionsMap.values()),
    overriddenCount,
  }
}

async function findIndexFileWithLayers(
  paths: string[],
  extensions = ['ts', 'js', 'mts', 'mjs'],
): Promise<string | null> {
  if (paths.length === 0) {
    return null
  }

  const layerDirectories = getLayerDirectories()

  for (const layer of layerDirectories) {
    const indexPatterns = paths.flatMap(pathPattern =>
      extensions.map(ext => resolvePath(layer.server, `${pathPattern}/index.${ext}`)),
    )

    const indexFiles = await glob(indexPatterns, {
      absolute: true,
      onlyFiles: true,
    })

    if (indexFiles.length > 0) {
      return indexFiles[0]!
    }
  }

  return null
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: 'mcp',
    docs: 'https://mcp-toolkit.nuxt.dev/getting-started/installation',
    mcp: 'https://mcp-toolkit.nuxt.dev/mcp',
  },
  defaults: defaultMcpConfig,
  async setup(options, nuxt) {
    // Cannot be used with `nuxt generate`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (nuxt.options.nitro.static || (nuxt.options as any)._generate) {
      log.warn('@nuxtjs/mcp-toolkit is not compatible with `nuxt generate` as it needs a server to run.')
      return
    }

    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.mcp = defu(
      nuxt.options.runtimeConfig.mcp,
      {
        enabled: options.enabled,
        route: options.route,
        browserRedirect: options.browserRedirect,
        name: options.name,
        version: options.version,
        dir: options.dir,
      },
    )

    if (!options.enabled) {
      return
    }

    addComponent({
      name: 'InstallButton',
      filePath: resolver.resolve('runtime/components/InstallButton.vue'),
    })

    const mcpDir = options.dir ?? defaultMcpConfig.dir

    const paths = {
      tools: [`${mcpDir}/tools`],
      resources: [`${mcpDir}/resources`],
      prompts: [`${mcpDir}/prompts`],
      handlers: [mcpDir],
    }

    let mcpSummary: string | null = null

    nuxt.hook('modules:done', async () => {
      try {
        await nuxt.callHook('mcp:definitions:paths', paths)

        // Load definitions with Nuxt layers support
        const [toolsResult, resourcesResult, promptsResult, handlersResult, indexFile] = await Promise.all([
          loadDefinitionFilesWithLayers(paths.tools),
          loadDefinitionFilesWithLayers(paths.resources),
          loadDefinitionFilesWithLayers(paths.prompts),
          loadDefinitionFilesWithLayers(paths.handlers, {
            filter: (filePath) => {
              const relativePath = filePath.replace(/.*\/server\//, '')
              const filename = filePath.split('/').pop()!
              const isIndexFile = /^index\.(?:ts|js|mts|mjs)$/.test(filename)
              return !relativePath.includes('/tools/')
                && !relativePath.includes('/resources/')
                && !relativePath.includes('/prompts/')
                && !isIndexFile
            },
          }),
          findIndexFileWithLayers(paths.handlers),
        ])

        // Generate virtual modules for definitions
        addServerTemplate({
          filename: '#nuxt-mcp/tools.mjs',
          getContents: () => {
            if (toolsResult.count === 0) {
              return `export const tools = []\n`
            }
            const entries = toolsResult.files.map((file) => {
              const filename = file.split('/').pop()!
              const identifier = toIdentifier(filename)
              return [identifier, file] as [string, string]
            })
            return createTemplateContent('tools', entries)
          },
        })

        addServerTemplate({
          filename: '#nuxt-mcp/resources.mjs',
          getContents: () => {
            if (resourcesResult.count === 0) {
              return `export const resources = []\n`
            }
            const entries = resourcesResult.files.map((file) => {
              const filename = file.split('/').pop()!
              const identifier = toIdentifier(filename)
              return [identifier, file] as [string, string]
            })
            return createTemplateContent('resources', entries)
          },
        })

        addServerTemplate({
          filename: '#nuxt-mcp/prompts.mjs',
          getContents: () => {
            if (promptsResult.count === 0) {
              return `export const prompts = []\n`
            }
            const entries = promptsResult.files.map((file) => {
              const filename = file.split('/').pop()!
              const identifier = toIdentifier(filename)
              return [identifier, file] as [string, string]
            })
            return createTemplateContent('prompts', entries)
          },
        })

        addServerTemplate({
          filename: '#nuxt-mcp/handlers.mjs',
          getContents: () => {
            if (handlersResult.count === 0) {
              return `export const handlers = []\n`
            }
            const entries = handlersResult.files.map((file) => {
              const filename = file.split('/').pop()!
              const identifier = toIdentifier(filename)
              return [identifier, file] as [string, string]
            })
            return createTemplateContent('handlers', entries)
          },
        })

        addServerTemplate({
          filename: '#nuxt-mcp/default-handler.mjs',
          getContents: () => {
            if (!indexFile) {
              return `export const defaultHandler = null\n`
            }
            return `import handler from '${indexFile}'\nexport const defaultHandler = handler\n`
          },
        })

        if (handlersResult.count > 0) {
          addServerHandler({
            route: ROUTES.CUSTOM_HANDLER,
            handler: resolver.resolve('runtime/server/mcp/handler'),
          })
        }

        const totalCount = toolsResult.count + resourcesResult.count + promptsResult.count + handlersResult.count

        if (totalCount === 0) {
          log.warn('No MCP definitions found. Create tools, resources, or prompts in server/mcp/')
        }
        else {
          const summary: string[] = []
          if (toolsResult.count > 0) summary.push(`${toolsResult.count} tool${toolsResult.count > 1 ? 's' : ''}`)
          if (resourcesResult.count > 0) summary.push(`${resourcesResult.count} resource${resourcesResult.count > 1 ? 's' : ''}`)
          if (promptsResult.count > 0) summary.push(`${promptsResult.count} prompt${promptsResult.count > 1 ? 's' : ''}`)
          if (handlersResult.count > 0) summary.push(`${handlersResult.count} handler${handlersResult.count > 1 ? 's' : ''}`)

          mcpSummary = summary.join(', ')
        }
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.error('Failed to initialize MCP server')
        log.error(`Error: ${errorMessage}`)
        throw error
      }
    })

    nuxt.hook('listen', (_, listener) => {
      if (!mcpSummary) return

      const ide = detectIDE()
      if (ide) {
        const baseUrl = listener.url.replace(/\/$/, '')
        const mcpUrl = `${baseUrl}${options.route}`

        // Check if the MCP server is already installed
        const installedConfig = findInstalledMCPConfig(ide, nuxt.options.rootDir, mcpUrl)
        if (installedConfig) {
          log.success(`\`${options.route}\` enabled with ${mcpSummary} · MCP server already installed in \`${installedConfig.displayPath}\``)
          return
        }

        const ideName = IDE_CONFIGS[ide].name
        const deeplinkUrl = generateDeeplinkUrl(baseUrl, options.route!, ide, options.name || 'mcp-server')
        log.info(`${ideName} detected. ${terminalLink('Install Nuxt MCP server', deeplinkUrl)}`)
        log.success(`\`${options.route}\` enabled with ${mcpSummary}`)
      }
      else {
        log.success(`\`${options.route}\` enabled with ${mcpSummary}`)
      }
    })

    nuxt.hook('prepare:types', ({ references }) => {
      references.push({
        path: resolver.resolve('runtime/server/types.server.d.ts'),
      })
    })

    nuxt.options.nitro.typescript ??= {}
    nuxt.options.nitro.typescript.tsConfig ??= {}
    nuxt.options.nitro.typescript.tsConfig.include ??= []
    nuxt.options.nitro.typescript.tsConfig.include.push(resolver.resolve('runtime/server/types.server.d.ts'))

    // Generate transport template based on preset (cloudflare vs node)
    let isCloudflare = false
    if (!nuxt.options.dev) {
      nuxt.hook('nitro:config', (nitroConfig) => {
        const preset = nitroConfig.preset || process.env.NITRO_PRESET || ''
        isCloudflare = preset.includes('cloudflare')
      })
    }

    addServerTemplate({
      filename: '#nuxt-mcp/transport.mjs',
      getContents: () => {
        const provider = isCloudflare ? 'cloudflare' : 'node'
        return `export { default } from '${resolver.resolve(`runtime/server/mcp/providers/${provider}`)}'`
      },
    })

    const mcpDefinitionsPath = resolver.resolve('runtime/server/mcp/definitions')

    addServerImports([
      'defineMcpTool',
      'defineMcpResource',
      'defineMcpPrompt',
      'defineMcpHandler',
      'textResult',
      'jsonResult',
      'errorResult',
      'imageResult',
    ].map(name => ({ name, from: mcpDefinitionsPath })))

    addServerHandler({
      route: options.route,
      handler: resolver.resolve('runtime/server/mcp/handler'),
    })

    addServerHandler({
      route: `${options.route}/deeplink`,
      handler: resolver.resolve('runtime/server/mcp/deeplink'),
    })

    addServerHandler({
      route: `${options.route}/badge.svg`,
      handler: resolver.resolve('runtime/server/mcp/badge-image'),
    })

    // Add Nuxt DevTools integration
    addDevToolsCustomTabs(nuxt, options)
  },
})
