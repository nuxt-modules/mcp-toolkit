import type { z, ZodRawShape, ZodTypeAny } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'

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
export interface McpToolDefinition<Args extends ZodRawShape = ZodRawShape, OutputArgs extends ZodRawShape = ZodRawShape> {
  name: string
  description: string
  paramsSchema: Args
  outputSchema?: OutputArgs
  handler: McpToolCallback<Args>
}

/**
 * Helper function to register a tool from a McpToolDefinition
 * This provides better type inference when registering tools
 */
export function registerToolFromDefinition<
  Args extends ZodRawShape,
  OutputArgs extends ZodRawShape = ZodRawShape,
>(
  server: McpServer,
  tool: McpToolDefinition<Args, OutputArgs>,
) {
  return registerTypedTool<Args, OutputArgs>(
    server,
    tool.name,
    {
      title: tool.name,
      description: tool.description,
      inputSchema: tool.paramsSchema,
      ...(tool.outputSchema && { outputSchema: tool.outputSchema }),
    },
    tool.handler,
  )
}

/**
 * Helper function to register a tool with improved type inference
 */
export function registerTypedTool<
  InputSchema extends ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
>(
  server: McpServer,
  name: string,
  config: {
    title?: string
    description?: string
    inputSchema?: InputSchema
    outputSchema?: OutputSchema
    annotations?: ToolAnnotations
    _meta?: Record<string, unknown>
  },
  cb: (
    args: z.objectOutputType<InputSchema, ZodTypeAny>,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>,
  ) => CallToolResult | Promise<CallToolResult>,
) {
  return server.registerTool<InputSchema, OutputSchema>(
    name,
    {
      title: config.title,
      description: config.description,
      inputSchema: config.inputSchema,
      outputSchema: config.outputSchema,
      annotations: config.annotations,
      _meta: config._meta,
    },
    cb as ToolCallback<InputSchema>,
  )
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
export function defineMcpTool<Args extends ZodRawShape, OutputArgs extends ZodRawShape = ZodRawShape>(
  definition: McpToolDefinition<Args, OutputArgs>,
): McpToolDefinition<Args, OutputArgs> {
  return definition
}
