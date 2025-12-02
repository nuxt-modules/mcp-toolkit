import type { ZodRawShape } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { enrichNameTitle } from './utils'
import { type MsCacheDuration, type McpCacheOptions, type McpCache, createCacheOptions, wrapWithCache } from './cache'

// Re-export cache types for convenience
export type { MsCacheDuration }
export type McpToolCacheOptions<Args = unknown> = McpCacheOptions<Args>
export type McpToolCache<Args = unknown> = McpCache<Args>

/**
 * Handler callback type for MCP tools
 */
export type McpToolCallback<Args extends ZodRawShape | undefined = ZodRawShape> = Args extends ZodRawShape
  ? (args: ShapeOutput<Args>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult>
  : (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => CallToolResult | Promise<CallToolResult>

/**
 * MCP tool definition structure
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/tools
 */
export interface McpToolDefinition<
  InputSchema extends ZodRawShape | undefined = ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
> {
  name?: string
  title?: string
  description?: string
  inputSchema?: InputSchema
  outputSchema?: OutputSchema
  annotations?: ToolAnnotations
  _meta?: Record<string, unknown>
  handler: McpToolCallback<InputSchema>
  /**
   * Cache configuration for the tool response
   * - string: Duration parsed by `ms` (e.g., '1h', '2 days', '30m')
   * - number: Duration in milliseconds
   * - object: Full cache options with getKey, group, swr, etc.
   * @see https://nitro.build/guide/cache#options
   */
  cache?: McpToolCache<InputSchema extends ZodRawShape ? ShapeOutput<InputSchema> : undefined>
}

/**
 * Register a tool from a McpToolDefinition
 * @internal
 */
export function registerToolFromDefinition<
  InputSchema extends ZodRawShape | undefined = ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
>(
  server: McpServer,
  tool: McpToolDefinition<InputSchema, OutputSchema>,
) {
  const { name, title } = enrichNameTitle({
    name: tool.name,
    title: tool.title,
    _meta: tool._meta,
    type: 'tool',
  })

  // Wrap handler with cache if cache is defined
  let handler = tool.handler as unknown as ToolCallback<ZodRawShape>

  if (tool.cache !== undefined) {
    const defaultGetKey = tool.inputSchema
      ? (args: unknown) => {
          const values = Object.values(args as Record<string, unknown>)
          return values.map(v => String(v).replace(/\//g, '-').replace(/^-/, '')).join(':')
        }
      : undefined

    const cacheOptions = createCacheOptions(tool.cache, `mcp-tool:${name}`, defaultGetKey)

    handler = wrapWithCache(
      tool.handler as unknown as (...args: unknown[]) => unknown,
      cacheOptions,
    ) as unknown as ToolCallback<ZodRawShape>
  }

  if (tool.inputSchema) {
    return server.registerTool<ZodRawShape, OutputSchema>(
      name,
      {
        title,
        description: tool.description,
        inputSchema: tool.inputSchema as ZodRawShape,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
        _meta: tool._meta,
      },
      handler,
    )
  }
  else {
    return server.registerTool<ZodRawShape, OutputSchema>(
      name,
      {
        title,
        description: tool.description,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
        _meta: tool._meta,
      },
      handler,
    )
  }
}

/**
 * Define an MCP tool that will be automatically registered.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/tools
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   description: 'Echo back a message',
 *   inputSchema: { message: z.string() },
 *   cache: '1h', // optional caching
 *   handler: async ({ message }) => ({
 *     content: [{ type: 'text', text: message }]
 *   })
 * })
 * ```
 */
export function defineMcpTool<
  const InputSchema extends ZodRawShape | undefined = ZodRawShape,
  const OutputSchema extends ZodRawShape = ZodRawShape,
>(
  definition: McpToolDefinition<InputSchema, OutputSchema>,
): McpToolDefinition<InputSchema, OutputSchema> {
  return definition
}
