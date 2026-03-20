import { type H3Event, isError as isH3Error } from 'h3'
import type { ZodRawShape } from 'zod'
import type { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { enrichNameTitle } from './utils'
import { type MsCacheDuration, type McpCacheOptions, type McpCache, createCacheOptions, wrapWithCache } from './cache'
import { type McpToolCallbackResult, normalizeToolResult } from './results'

export type { McpToolCallbackResult }

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
 * Extra arguments passed to MCP tool/prompt/resource handlers by the SDK.
 * Provides access to the abort signal, auth info, session ID, and request metadata.
 */
export type McpToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

/**
 * Handler callback type for MCP tools
 */
export type McpToolCallback<Args extends ZodRawShape | undefined = ZodRawShape> = Args extends ZodRawShape
  ? (args: ShapeOutput<Args>, extra: McpToolExtra) => McpToolCallbackResult | Promise<McpToolCallbackResult>
  : (extra: McpToolExtra) => McpToolCallbackResult | Promise<McpToolCallbackResult>

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
  /**
   * Functional group this tool belongs to (e.g. `'admin'`, `'content'`).
   * Auto-inferred from directory structure when omitted
   * (e.g. `server/mcp/tools/admin/delete-user.ts` → `'admin'`).
   * @see https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1300
   */
  group?: string
  /**
   * Free-form tags for filtering and categorization
   * (e.g. `['destructive', 'user-management']`).
   * @see https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1300
   */
  tags?: string[]
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
  /**
   * Guard that controls whether this tool is registered for a given request.
   * Receives the H3 event (with `event.context` populated by middleware) and
   * returns `true` to include the tool or `false` to hide it.
   *
   * Evaluated after middleware runs, so authentication context is available.
   */
  enabled?: (event: H3Event) => boolean | Promise<boolean>
}

/**
 * Convert a thrown error into an MCP-compliant `isError` result.
 *
 * Supports H3 errors (`createError()`) natively — the status code and
 * any attached `data` are included in the error text.
 *
 * @internal
 */
export function normalizeErrorToResult(error: unknown): CallToolResult {
  if (isH3Error(error)) {
    let text = `[${error.statusCode}] ${error.message}`
    if (error.data != null) {
      text += `\n${JSON.stringify(error.data, null, 2)}`
    }
    return { content: [{ type: 'text', text }], isError: true }
  }
  if (error instanceof Error) {
    return { content: [{ type: 'text', text: error.message }], isError: true }
  }
  return { content: [{ type: 'text', text: String(error) }], isError: true }
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
  let handler = tool.handler as (...args: unknown[]) => unknown

  if (tool.cache !== undefined) {
    const defaultGetKey = tool.inputSchema
      ? (args: unknown) => {
          const values = Object.values(args as Record<string, unknown>)
          return values.map(v => String(v).replace(/\//g, '-').replace(/^-/, '')).join(':')
        }
      : undefined

    const cacheOptions = createCacheOptions(tool.cache, `mcp-tool:${name}`, defaultGetKey)

    handler = wrapWithCache(handler, cacheOptions)
  }

  // Normalize returns and catch thrown errors into isError results
  const normalizedHandler: ToolCallback<ZodRawShape> = async (...args: unknown[]) => {
    try {
      const result = await (handler as (...a: unknown[]) => unknown)(...args)
      return normalizeToolResult(result as McpToolCallbackResult)
    }
    catch (error) {
      return normalizeErrorToResult(error)
    }
  }

  const group = tool.group ?? (tool._meta?.group as string | undefined)

  const options = {
    title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
    _meta: {
      ...tool._meta,
      ...(tool.inputExamples && { inputExamples: tool.inputExamples }),
      ...(group != null && { group }),
      ...(tool.tags?.length && { tags: tool.tags }),
    },
  }

  return server.registerTool(name, options, normalizedHandler)
}

/**
 * Define an MCP tool that will be automatically registered.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * Handlers can return a full `CallToolResult`, or a simplified value
 * (`string`, `number`, `boolean`, object, array) which is automatically
 * wrapped into `{ content: [{ type: 'text', text: '...' }] }`.
 *
 * Thrown errors are caught and converted to MCP `isError` results.
 * H3 errors (`createError()`) include the status code in the response.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/tools
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   description: 'Get a user by ID',
 *   inputSchema: { id: z.string() },
 *   handler: async ({ id }) => {
 *     const user = await getUser(id)
 *     if (!user) throw createError({ statusCode: 404, message: 'User not found' })
 *     return user
 *   },
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
