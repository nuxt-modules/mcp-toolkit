import { createModule } from './shared.ts'
import type { McpModuleOptions } from './options.ts'
import type { McpToolCall } from '../runtime/tool.ts'
import type { NitroModule } from 'nitro/types'

export type {
  McpModuleOAuthOptions,
  McpModuleOptions,
  McpServerOptions,
  ResolvedMcpModuleOptions,
} from './options.ts'

declare module 'nitro/types' {
  interface NitroRuntimeHooks {
    /**
     * Fires once per tool call that settles into a result, on every endpoint the
     * module serves. An error a listener throws reaches the client.
     *
     * @example
     * ```ts
     * // server/plugins/mcp-metrics.ts
     * export default definePlugin((nitroApp) => {
     *   nitroApp.hooks.hook('mcp:tool:called', ({ name, result, durationMs }) => {
     *     metric('mcp.tool.duration_ms', durationMs, { toolName: name, outcome: result.isError ? 'error' : 'success' })
     *   })
     * })
     * ```
     */
    'mcp:tool:called': (call: McpToolCall) => void | Promise<void>
  }
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
export default function mcp(options: McpModuleOptions = {}) {
  return createModule(options) satisfies NitroModule
}
