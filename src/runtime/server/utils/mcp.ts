import type { z, ZodRawShape, ZodTypeAny } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'

/**
 * Callback type for MCP tools, matching the SDK's ToolCallback type
 */
export type McpToolCallback<Args extends ZodRawShape = ZodRawShape> = (
  args: z.objectOutputType<Args, ZodTypeAny>,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
) => CallToolResult | Promise<CallToolResult>

/**
 * Definition of an MCP tool with proper typing
 */
export interface McpToolDefinition<Args extends ZodRawShape = ZodRawShape> {
  name: string
  description: string
  paramsSchema: Args
  handler: McpToolCallback<Args>
}

/**
 * Define an MCP tool that will be automatically registered
 *
 * @example
 * ```ts
 * // server/mcp/tools/my-tool.ts
 * export default defineMcpTool({
 *   name: 'my_tool',
 *   description: 'Description of my tool',
 *   paramsSchema: {
 *     param1: z.string().describe('Parameter description'),
 *   },
 *   handler: async (params) => {
 *     // Your tool logic here
 *     return {
 *       content: [{ type: 'text', text: 'Result' }]
 *     }
 *   }
 * })
 * ```
 */
export function defineMcpTool<Args extends ZodRawShape>(
  definition: McpToolDefinition<Args>,
): McpToolDefinition<Args> {
  return definition
}
