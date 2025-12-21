import type { McpToolDefinition } from './tools'
import type { McpResourceDefinition } from './resources'
import type { McpPromptDefinition } from './prompts'

/**
 * Options for defining a custom MCP handler
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/handlers
 */
export interface McpHandlerOptions {
  /**
   * The name of the handler. Required for custom handlers accessed via /mcp/:handler.
   * Optional for default handler override (server/mcp/index.ts).
   */
  name?: string
  version?: string
  /**
   * Custom route for the handler.
   * Only used for custom handlers (not for default handler override in index.ts).
   * To change the default route, use `mcp.route` in nuxt.config.ts.
   */
  route?: string
  browserRedirect?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<McpToolDefinition<any, any>>
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
}

export interface McpHandlerDefinition extends Required<Omit<McpHandlerOptions, 'tools' | 'resources' | 'prompts'>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Array<McpToolDefinition<any, any>>
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
}

/**
 * Define a custom MCP handler with specific tools, resources, and prompts.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/handlers
 *
 * @example Custom handler (accessible via /mcp/:handler)
 * ```ts
 * // server/mcp/my-handler.ts
 * export default defineMcpHandler({
 *   name: 'my-handler',
 *   tools: [myTool],
 *   resources: [myResource]
 * })
 * ```
 *
 * @example Default handler override (server/mcp/index.ts)
 * ```ts
 * // server/mcp/index.ts - overrides the default /mcp handler config
 * export default defineMcpHandler({
 *   version: '2.0.0',
 *   browserRedirect: '/docs',
 *   // Note: 'route' is ignored here. Use mcp.route in nuxt.config.ts instead.
 *   // If tools/resources/prompts not specified, uses global definitions
 * })
 * ```
 */
export function defineMcpHandler(options: McpHandlerOptions): McpHandlerOptions {
  return options
}
