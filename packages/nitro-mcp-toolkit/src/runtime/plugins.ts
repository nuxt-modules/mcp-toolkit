import type { ExtensionPlugin } from 'h3-mcp'

/**
 * Define the extension plugins an endpoint installs, as the default export of
 * `<dir>/plugins.ts`.
 *
 * Only the generated handler imports that file, and generated code is not
 * typechecked with the app, so this call is what checks it.
 *
 * @example
 * ```ts
 * // server/mcp/plugins.ts
 * import { mcpTasks } from 'h3-mcp/tasks'
 *
 * export default defineMcpPlugins([mcpTasks({ max: 100 })])
 * ```
 */
export function defineMcpPlugins(plugins: readonly ExtensionPlugin[]): readonly ExtensionPlugin[] {
  return plugins
}
