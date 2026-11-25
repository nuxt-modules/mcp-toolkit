import type { ExtensionPlugin } from 'h3-mcp'

/**
 * An engine extension, such as `mcpTasks()` from `h3-mcp/tasks`.
 *
 * @experimental This is the protocol engine's plugin contract and may change in any release.
 */
export type McpExtensionPlugin = ExtensionPlugin

/**
 * Define the extension plugins an endpoint installs, as the default export of
 * `<dir>/plugins.ts`.
 *
 * @experimental Plugins follow the protocol engine's contract and may change in any release.
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
export function defineMcpPlugins(
  plugins: readonly McpExtensionPlugin[],
): readonly McpExtensionPlugin[] {
  return plugins
}
