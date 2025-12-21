import type { H3Event } from 'h3'
import type { McpToolDefinition } from './tools'
import type { McpResourceDefinition } from './resources'
import type { McpPromptDefinition } from './prompts'

/**
 * MCP middleware function that runs before/after MCP request processing.
 * Receives the H3 event and a next function to call the MCP handler.
 *
 * @param event - The H3 event object
 * @param next - Function to call the MCP handler
 * @returns The response or void
 *
 * @example
 * ```ts
 * middleware: async (event, next) => {
 *   // Before: set context, validate auth, log, etc.
 *   event.context.userId = await validateToken(getHeader(event, 'authorization'))
 *
 *   const response = await next()
 *
 *   // After: log duration, modify response, etc.
 *   return response
 * }
 * ```
 */
export type McpMiddleware = (
  event: H3Event,
  next: () => Promise<Response | undefined>,
) => Promise<Response | undefined> | Response | undefined

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
  /**
   * Middleware to run before/after MCP request processing.
   * Receives the H3 event and a next() function to call the handler.
   *
   * @example
   * ```ts
   * middleware: async (event, next) => {
   *   console.log('Before MCP request')
   *   const response = await next()
   *   console.log('After MCP request')
   *   return response
   * }
   * ```
   */
  middleware?: McpMiddleware
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<McpToolDefinition<any, any>>
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
}

export interface McpHandlerDefinition extends Required<Omit<McpHandlerOptions, 'tools' | 'resources' | 'prompts' | 'middleware'>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Array<McpToolDefinition<any, any>>
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
  middleware?: McpMiddleware
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
