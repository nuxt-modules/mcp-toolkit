import { resolve } from 'pathe'
import { discoverDefinitions } from './discover.ts'
import { resolveModuleOptions } from './options.ts'
import { reportDefinitions } from './report.ts'
import { renderHandler, renderRegistry } from './template.ts'
import { watchDefinitions } from './watch.ts'
import type { McpModuleOptions } from './options.ts'
import type { NitroModule } from 'nitro/types'

export type { McpModuleOptions, McpServerOptions, ResolvedMcpModuleOptions } from './options.ts'

/** `/admin/mcp` becomes `admin-mcp`, so two instances get distinct module ids. */
function slugify(route: string): string {
  return (
    route
      .replace(/^\//, '')
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase() || 'root'
  )
}

/**
 * Serve an MCP endpoint from the files under `dir`: every definition in
 * `tools/`, `resources/` and `prompts/` is registered, with no further wiring.
 *
 * Install it more than once for more than one server — Nitro only dedupes
 * modules given as a path, so each call is its own instance.
 *
 * @example
 * ```ts
 * // nitro.config.ts
 * import mcp from 'nitro-mcp-toolkit/module'
 *
 * export default defineConfig({
 *   modules: [
 *     mcp({ name: 'my-app', version: '1.0.0' }),
 *     mcp({ route: '/admin/mcp', dir: 'server/mcp-admin' }),
 *   ],
 * })
 * ```
 */
export default function mcp(options: McpModuleOptions = {}): NitroModule {
  const { route, dir, server } = resolveModuleOptions(options)
  const slug = slugify(route)

  return {
    name: `mcp:${slug}`,
    setup(nitro) {
      const registryId = `#mcp/${slug}/registry`
      const handlerId = `#mcp/${slug}/handler`

      if (handlerId in nitro.options.virtual) {
        throw new Error(
          `[nitro-mcp-toolkit] Two MCP servers are mounted on ${route}. ` +
            'Give each `mcp()` its own `route`.',
        )
      }

      const definitionsDir = resolve(nitro.options.rootDir, dir)

      nitro.options.virtual[registryId] = async () =>
        renderRegistry(await discoverDefinitions(definitionsDir))
      nitro.options.virtual[handlerId] = () => renderHandler(registryId, server)

      nitro.options.handlers.push({
        route,
        handler: handlerId,
        // Matches Nitro's own file-based routes: the MCP SDK is only loaded
        // once a request actually asks for it.
        lazy: true,
        middleware: false,
      })

      reportDefinitions(nitro, route, definitionsDir)

      if (nitro.options.dev) {
        watchDefinitions(nitro, definitionsDir)
      }
    },
  }
}
