import type { ZodRawShape } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { enrichNameTitle } from './utils'
import { type MsCacheDuration, type McpCacheOptions, type McpCache, createCacheOptions, wrapWithCache } from './cache'

/**
 * Hints that describe tool behavior to MCP clients.
 *
 * Clients may use these to decide whether to prompt the user for confirmation (human-in-the-loop).
 * All properties are optional hints — they are not guaranteed to be respected by every client.
 *
 * @see https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations
 */
export interface McpToolAnnotations {
  /** If `true`, the tool does not modify any state (e.g. a read/search/lookup). Defaults to `false`. */
  readOnlyHint?: boolean
  /** If `true`, the tool may perform destructive operations like deleting data. Only meaningful when `readOnlyHint` is `false`. Defaults to `true`. */
  destructiveHint?: boolean
  /** If `true`, calling the tool multiple times with the same arguments has no additional effect beyond the first call. Only meaningful when `readOnlyHint` is `false`. Defaults to `false`. */
  idempotentHint?: boolean
  /** If `true`, the tool may interact with the outside world (e.g. external APIs, the internet). If `false`, the tool only operates on local/internal data. Defaults to `true`. */
  openWorldHint?: boolean
}

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
  annotations?: McpToolAnnotations
  inputExamples?: InputSchema extends ZodRawShape ? Partial<ShapeOutput<InputSchema>>[] : never
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
export function registerToolFromDefinition(
  server: McpServer,
  tool: McpToolDefinition,
) {
  const { name, title } = enrichNameTitle({
    name: tool.name,
    title: tool.title,
    _meta: tool._meta,
    type: 'tool',
  })

  // Wrap handler with cache if cache is defined
  let handler: ToolCallback<ZodRawShape> = tool.handler as ToolCallback<ZodRawShape>

  if (tool.cache !== undefined) {
    const defaultGetKey = tool.inputSchema
      ? (args: unknown) => {
          const values = Object.values(args as Record<string, unknown>)
          return values.map(v => String(v).replace(/\//g, '-').replace(/^-/, '')).join(':')
        }
      : undefined

    const cacheOptions = createCacheOptions(tool.cache, `mcp-tool:${name}`, defaultGetKey)

    handler = wrapWithCache(
      tool.handler as (...args: unknown[]) => unknown,
      cacheOptions,
    ) as ToolCallback<ZodRawShape>
  }

  const options = {
    title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
    _meta: {
      ...tool._meta,
      ...(tool.inputExamples && { inputExamples: tool.inputExamples }),
    },
  }

  return server.registerTool(name, options, handler)
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
