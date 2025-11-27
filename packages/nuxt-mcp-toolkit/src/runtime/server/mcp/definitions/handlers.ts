import type { McpToolDefinition } from './tools'
import type { McpResourceDefinition } from './resources'
import type { McpPromptDefinition } from './prompts'

/**
 * Options for defining a custom MCP handler
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/handlers
 */
export interface McpHandlerOptions {
  name: string
  version?: string
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
 * @example
 * ```ts
 * export default defineMcpHandler({
 *   name: 'my-handler',
 *   tools: [myTool],
 *   resources: [myResource]
 * })
 * ```
 */
export function defineMcpHandler(options: McpHandlerOptions): McpHandlerOptions {
  return options
}
