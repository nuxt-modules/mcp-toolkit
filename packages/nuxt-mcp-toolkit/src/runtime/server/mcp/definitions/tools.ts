import type { ZodRawShape } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { defineCachedFunction } from 'nitropack/runtime'
import { enrichNameTitle } from './utils'
import ms from 'ms'

/**
 * Cache duration strings supported by the `ms` package
 */
export type MsCacheDuration
  = | '1s' | '5s' | '10s' | '15s' | '30s' | '45s' // seconds
    | '1m' | '2m' | '5m' | '10m' | '15m' | '30m' | '45m' // minutes
    | '1h' | '2h' | '3h' | '4h' | '6h' | '8h' | '12h' | '24h' // hours
    | '1d' | '2d' | '3d' | '7d' | '14d' | '30d' // days
    | '1w' | '2w' | '4w' // weeks
    | '1 second' | '1 minute' | '1 hour' | '1 day' | '1 week'
    | '2 seconds' | '5 seconds' | '10 seconds' | '30 seconds'
    | '2 minutes' | '5 minutes' | '10 minutes' | '15 minutes' | '30 minutes'
    | '2 hours' | '3 hours' | '6 hours' | '12 hours' | '24 hours'
    | '2 days' | '3 days' | '7 days' | '14 days' | '30 days'
    | '2 weeks' | '4 weeks'
    | (string & Record<never, never>)

/**
 * Cache options for MCP tools using Nitro's caching system
 * @see https://nitro.build/guide/cache#options
 */
export interface McpToolCacheOptions<Args = unknown> {
  /** Cache duration as string (e.g. '1h') or milliseconds */
  maxAge?: MsCacheDuration | number
  /** Duration for stale-while-revalidate */
  staleMaxAge?: number
  /** Cache name (auto-generated from tool name by default) */
  name?: string
  /** Function to generate cache key from arguments */
  getKey?: (args: Args) => string
  /** Cache group (default: 'mcp') */
  group?: string
  /** Enable stale-while-revalidate behavior */
  swr?: boolean
}

/**
 * Cache configuration: string duration, milliseconds, or full options
 * @see https://nitro.build/guide/cache#options
 */
export type McpToolCache<Args = unknown> = MsCacheDuration | number | McpToolCacheOptions<Args>

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
 * Parse cache duration to milliseconds
 */
function parseCacheDuration(duration: MsCacheDuration | number): number {
  if (typeof duration === 'number') {
    return duration
  }
  const parsed = ms(duration as Parameters<typeof ms>[0])
  if (parsed === undefined) {
    throw new Error(`Invalid cache duration: ${duration}`)
  }
  return parsed
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
    let cacheOptions: {
      maxAge: number
      staleMaxAge?: number
      name: string
      group: string
      swr?: boolean
      getKey: (args: unknown) => string
    }

    if (typeof tool.cache === 'string' || typeof tool.cache === 'number') {
      // Simple duration format
      cacheOptions = {
        maxAge: parseCacheDuration(tool.cache),
        name: `mcp-tool:${name}`,
        group: 'mcp',
        getKey: (args: unknown) => JSON.stringify(args ?? {}),
      }
    }
    else {
      // Full options object
      const config = tool.cache
      cacheOptions = {
        maxAge: config.maxAge !== undefined ? parseCacheDuration(config.maxAge) : 60 * 60 * 1000, // 1 hour default
        staleMaxAge: config.staleMaxAge,
        name: config.name ?? `mcp-tool:${name}`,
        group: config.group ?? 'mcp',
        swr: config.swr,
        getKey: config.getKey
          ? (args: unknown) => (config.getKey as (args: unknown) => string)(args)
          : (args: unknown) => JSON.stringify(args ?? {}),
      }
    }

    handler = defineCachedFunction(
      tool.handler as unknown as ToolCallback<ZodRawShape>,
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
