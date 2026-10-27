import { addServerHandler, addServerPlugin, addServerTemplate, createResolver, defineNuxtModule, getLayerDirectories, getNitroVersion, hasNuxtModule, logger, resolveServerVariant } from '@nuxt/kit'
import mcp from 'nitro-mcp-toolkit/module/nitro2'
import mcp3 from 'nitro-mcp-toolkit/module'
import { resolve as resolvePath } from 'pathe'
import { setupAutoImports } from './setup/auto-imports'
import type { McpModuleOptions } from 'nitro-mcp-toolkit/module/nitro2'
import { name, version } from '../package.json'

export const { resolve } = createResolver(import.meta.url)
export type McpHeaderValue = string | string[] | null | undefined
export interface McpInspectorConfig { headers?: Record<string, McpHeaderValue> }

export interface ModuleOptions extends Omit<McpModuleOptions, 'include'> {
  enabled?: boolean
  autoImports?: boolean
  /** Named endpoints. Directories are relative to each Nuxt layer's server directory. */
  servers?: Record<string, Omit<McpModuleOptions, 'include'>>
  inspector?: McpInspectorConfig
  llms?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: { name, version, configKey: 'mcp', compatibility: { nuxt: '>=4.6.0' } },
  defaults: { enabled: true, autoImports: true, name: 'nuxt-mcp-server', route: '/mcp', llms: true },
  setup(options, nuxt) {
    if (!options.enabled) return
    if (nuxt.options.nitro.static || ('_generate' in nuxt.options && nuxt.options._generate === true)) {
      logger.warn('MCP endpoints require a server and cannot be generated as static files.')
      return
    }
    const nitroVersion = getNitroVersion(nuxt)
    if ((nitroVersion !== 2 && nitroVersion !== 3) || !resolveServerVariant({ nitro2: true, nitro3: true })) {
      throw new Error('@nuxtjs/mcp-toolkit requires a Nitro 2 or Nitro 3 server builder.')
    }

    const resolver = createResolver(import.meta.url)
    const { enabled: _enabled, autoImports, servers, inspector: _inspector, llms, ...defaults } = options
    const layers = getLayerDirectories()
    const baseRoute = defaults.route ?? '/mcp'
    const configured = new Map(Object.entries(servers ?? { default: {} }))
    const instances: (ReturnType<typeof mcp> | ReturnType<typeof mcp3>)[] = []
    const createModule = nitroVersion === 2 ? mcp : mcp3
    if (autoImports) setupAutoImports(resolver)

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/config.mjs',
      getContents: () => `export default ${JSON.stringify({ name: options.name, route: baseRoute, description: options.description, websiteUrl: options.websiteUrl })}`,
    })

    nuxt.hook('modules:done', () => {
      for (const [key, server] of configured) {
        const { dir = key === 'default' ? 'mcp' : `mcp-${key}`, ...config } = { ...defaults, ...server }
        const dirs = typeof dir === 'string' ? [dir] : dir
        instances.push(createModule({
          ...config,
          route: server.route ?? (key === 'default' ? baseRoute : `${baseRoute}/${key}`),
          dir: [...new Set(dirs.flatMap(root => layers.map(layer => resolvePath(layer.server, root))))],
        }))
      }
    })

    nuxt.hook('nitro:config', (config) => {
      config.modules ??= []
      config.modules.push(...instances)
    })
    const hooks = resolver.resolve('runtime/server/types/hooks.d.ts')
    const virtual = resolver.resolve('runtime/types/virtual-modules.d.ts')
    nuxt.hook('prepare:types', ({ references }) => {
      references.push({ path: hooks }, { path: virtual })
    })
    nuxt.hook('nitro:prepare:types', ({ references }) => {
      references.push({ path: hooks }, { path: virtual })
    })

    addServerHandler({ route: `${baseRoute}/deeplink`, handler: resolver.resolve('runtime/server/mcp/deeplink') })
    addServerHandler({ route: `${baseRoute}/badge.svg`, handler: resolver.resolve('runtime/server/mcp/badge-image') })
    if (llms && hasNuxtModule('nuxt-llms')) addServerPlugin(resolver.resolve('runtime/server/plugins/llms'))
    if (nuxt.options.dev) {
      void import('./runtime/server/mcp/devtools').then(({ addDevToolsCustomTabs }) => addDevToolsCustomTabs(nuxt, options))
    }
  },
})
