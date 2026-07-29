import { fileURLToPath } from 'node:url'
import type { NitroModule } from 'nitro/types'

export interface NitroMcpToolkitOptions {
  /**
   * HTTP route where the MCP server is mounted.
   *
   * @default '/mcp'
   */
  route?: string
}

const runtimeHandler = fileURLToPath(new URL('./runtime/handler.mjs', import.meta.url))

export function nitroMcpToolkit(options: NitroMcpToolkitOptions = {}): NitroModule {
  const route = options.route ?? '/mcp'

  return {
    name: 'nitro-mcp-toolkit',
    setup(nitro) {
      nitro.options.handlers.push({
        route,
        handler: runtimeHandler,
      })
    },
  }
}
