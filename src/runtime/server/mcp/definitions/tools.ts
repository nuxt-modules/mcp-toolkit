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
 * Definition of an MCP tool matching the SDK's registerTool signature
 * This structure is identical to what you'd pass to server.registerTool()
 */
export interface McpToolDefinition<
  InputSchema extends ZodRawShape = ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
> {
  name: string
  title?: string
  description?: string
  inputSchema: InputSchema
  outputSchema?: OutputSchema
  annotations?: ToolAnnotations
  _meta?: Record<string, unknown>
  handler: McpToolCallback<InputSchema>
}

/**
 * Helper function to register a tool from a McpToolDefinition
 * This provides better type inference when registering tools
 */
export function registerToolFromDefinition<
  InputSchema extends ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
>(
  server: McpServer,
  tool: McpToolDefinition<InputSchema, OutputSchema>,
) {
  return server.registerTool<InputSchema, OutputSchema>(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.annotations,
      _meta: tool._meta,
    },
    tool.handler as ToolCallback<InputSchema>,
  )
}

/**
 * Define an MCP tool that will be automatically registered
 *
 * This function matches the exact structure of server.registerTool() from the MCP SDK,
 * making it easy to migrate code from the SDK to this module.
 *
 * @example
 * ```ts
 * // server/mcp/tools/my-tool.ts
 * import { z } from 'zod'
 *
 * export default defineMcpTool({
 *   name: 'calculate-bmi',
 *   title: 'BMI Calculator',
 *   description: 'Calculate Body Mass Index',
 *   inputSchema: {
 *     weightKg: z.number(),
 *     heightM: z.number()
 *   },
 *   outputSchema: { bmi: z.number() },
 *   handler: async ({ weightKg, heightM }) => {
 *     const output = { bmi: weightKg / (heightM * heightM) }
 *     return {
 *       content: [{
 *         type: 'text',
 *         text: JSON.stringify(output)
 *       }],
 *       structuredContent: output
 *     }
 *   }
 * })
 * ```
 */
export function defineMcpTool<
  const InputSchema extends ZodRawShape,
  const OutputSchema extends ZodRawShape = ZodRawShape,
>(
  definition: McpToolDefinition<InputSchema, OutputSchema>,
): McpToolDefinition<InputSchema, OutputSchema> {
  return definition
}
