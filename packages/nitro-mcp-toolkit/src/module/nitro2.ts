import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, normalize, resolve } from 'pathe'
import { createModule } from './shared.ts'
import type { McpModuleOptions } from './options.ts'
import type { McpToolCall } from '../runtime/tool.ts'
import type { NitroModule } from 'nitropack/types'

export type {
  McpModuleOAuthOptions,
  McpModuleOptions,
  McpServerOptions,
  ResolvedMcpModuleOptions,
} from './options.ts'

declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    'mcp:tool:called': (call: McpToolCall) => void | Promise<void>
  }
}

/** Serve file-discovered MCP definitions in Nitro 2 while preserving its H3 v1 host. */
export default function mcp(options: McpModuleOptions = {}): NitroModule {
  const require = createRequire(import.meta.url)
  const h3 = normalize(require.resolve('h3/generic'))
  const engine = dirname(normalize(require.resolve('h3-mcp')))
  const runtime = resolve(dirname(fileURLToPath(import.meta.url)), '../runtime')
  const module = createModule(options, { h3 })

  return {
    name: module.name,
    setup(nitro) {
      nitro.options.alias.h3 ??= normalize(
        createRequire(require.resolve('nitropack/package.json')).resolve('h3'),
      )
      module.setup(nitro)
      nitro.hooks.hook('rollup:before', (_nitro, config) => {
        config.plugins = [
          {
            name: 'nitro-mcp-toolkit:h3-v2',
            resolveId(source: string, importer: string | undefined) {
              if (
                source === 'h3' &&
                importer &&
                [runtime, engine].some((dir) => normalize(importer).startsWith(`${dir}/`))
              ) {
                return h3
              }
            },
          },
          config.plugins,
        ]
      })
    },
  }
}
