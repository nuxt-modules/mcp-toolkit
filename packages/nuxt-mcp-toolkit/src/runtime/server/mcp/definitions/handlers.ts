import type { H3Event } from 'h3'
import type { McpToolDefinition } from './tools'
import type { McpResourceDefinition } from './resources'
import type { McpPromptDefinition } from './prompts'
import type { CodeModeOptions } from '../codemode'

/**
 * MCP middleware function that runs before/after MCP request processing.
 *
 * If you don't call `next()`, it will be called automatically after your middleware.
 * Call `next()` explicitly if you need to run code after the handler or modify the response.
 *
 * @param event - The H3 event object
 * @param next - Function to call the MCP handler
 *
 * @example Simple middleware (next() called automatically)
 * ```ts
 * middleware: async (event) => {
 *   // Just set context - next() is called automatically
 *   event.context.userId = 'user-123'
 * }
 * ```
 *
 * @example Full control middleware
 * ```ts
 * middleware: async (event, next) => {
 *   const start = Date.now()
 *   const response = await next()
 *   console.log(`Request took ${Date.now() - start}ms`)
 *   return response
 * }
 * ```
 */
export type McpMiddleware = (
  event: H3Event,
  next: () => Promise<Response>,
) => Promise<Response | void> | Response | void

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
   * Instructions describing what this MCP server does, when to use it,
   * and how it should be invoked. Sent to clients during initialization
   * to help AI agents understand the server's purpose.
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization
   */
  instructions?: string
  /**
   * Custom route for the handler.
   * Only used for custom handlers (not for default handler override in index.ts).
   * To change the default route, use `mcp.route` in nuxt.config.ts.
   */
  route?: string
  browserRedirect?: string
  /**
   * Middleware to run before/after MCP request processing.
   * If you don't call next(), it will be called automatically.
   *
   * @example Simple (next() auto-called)
   * ```ts
   * middleware: async (event) => {
   *   event.context.userId = 'user-123'
   * }
   * ```
   *
   * @example Full control
   * ```ts
   * middleware: async (event, next) => {
   *   const start = Date.now()
   *   const response = await next()
   *   console.log(`Took ${Date.now() - start}ms`)
   *   return response
   * }
   * ```
   */
  middleware?: McpMiddleware
  /**
   * @experimental
   * Enable Code Mode: wraps all tools into a single `code` tool.
   * The LLM writes JavaScript that calls tools via `codemode.*` methods,
   * executed in a secure V8 isolate via `secure-exec`.
   *
   * This feature is experimental and may change in future releases.
   * Requires `secure-exec` to be installed: `npm install secure-exec`
   *
   * @example
   * ```ts
   * export default defineMcpHandler({
   *   experimental_codeMode: true,
   * })
   * ```
   */
  experimental_codeMode?: boolean | CodeModeOptions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<McpToolDefinition<any, any>> | ((event: H3Event) => Array<McpToolDefinition<any, any>> | Promise<Array<McpToolDefinition<any, any>>>)
  resources?: McpResourceDefinition[] | ((event: H3Event) => McpResourceDefinition[] | Promise<McpResourceDefinition[]>)
  prompts?: McpPromptDefinition[] | ((event: H3Event) => McpPromptDefinition[] | Promise<McpPromptDefinition[]>)
}

export interface McpHandlerDefinition extends Required<Omit<McpHandlerOptions, 'tools' | 'resources' | 'prompts' | 'middleware' | 'instructions' | 'experimental_codeMode'>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Array<McpToolDefinition<any, any>>
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
  middleware?: McpMiddleware
  instructions?: string
  experimental_codeMode?: boolean | CodeModeOptions
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
