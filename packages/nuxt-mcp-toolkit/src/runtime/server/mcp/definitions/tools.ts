import { type H3Event, isError as isH3Error } from 'h3'
import type { ZodRawShape } from 'zod'
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import type { McpRequestExtra } from './sdk-extra'
import { enrichNameTitle } from './utils'
import { type MsCacheDuration, type McpCacheOptions, type McpCache, createCacheOptions, wrapWithCache } from './cache'
import { type McpToolCallbackResult, normalizeToolResult } from './results'

export type { McpToolCallbackResult }

/**
 * Hints that describe tool behavior to MCP clients (from `@modelcontextprotocol/sdk` `ToolAnnotations`).
 *
 * Clients may use these to decide whether to prompt the user for confirmation (human-in-the-loop).
 * All properties are optional hints — they are not guaranteed to be respected by every client.
 *
 * @see https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations
 */
export type McpToolAnnotations = ToolAnnotations

// Re-export cache types for convenience
export type { MsCacheDuration }
export type McpToolCacheOptions<Args = unknown> = McpCacheOptions<Args>
export type McpToolCache<Args = unknown> = McpCache<Args>

/** Narrow `any` so conditional callbacks do not union both handler signatures (TS quirk). */
type IsAny<T> = 0 extends (1 & T) ? true : false

/**
 * Handler callback type for MCP tools
 */
export type McpToolCallback<Args extends ZodRawShape | undefined = ZodRawShape> = IsAny<Args> extends true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous `McpToolDefinition<any, any>` lists
  ? (args: any, extra: McpRequestExtra) => McpToolCallbackResult | Promise<McpToolCallbackResult>
  : Args extends ZodRawShape
    ? (args: ShapeOutput<Args>, extra: McpRequestExtra) => McpToolCallbackResult | Promise<McpToolCallbackResult>
    : (extra: McpRequestExtra) => McpToolCallbackResult | Promise<McpToolCallbackResult>

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
  /**
   * JSON Schema for the tool output, forwarded to the MCP SDK for client metadata and validation.
   * It does not currently narrow the TypeScript return type of `handler` — return a value compatible
   * with your schema, or a full {@link CallToolResult} / structured content as needed.
   */
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
 * Tool slot in heterogeneous arrays (`defineMcpHandler({ tools: [...] })`, dynamic loaders).
 * Uses `any` for schema generics because TypeScript cannot safely unify distinct `inputSchema` shapes
 * in one array type; prefer `McpToolDefinition<YourShape>` on a single exported tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type McpToolDefinitionListItem = McpToolDefinition<any, any>

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
 * Resolve the normalized tool name used by registration and code mode.
 *
 * @internal
 */
export function resolveToolDefinitionName(tool: McpToolDefinition): string {
  const { name } = enrichNameTitle({
    name: tool.name,
    title: tool.title,
    _meta: tool._meta,
    type: 'tool',
  })
  return name
}

/**
 * Apply the shared registration wrappers that must also be used by code mode.
 *
 * @internal
 */
export function createWrappedToolHandler(tool: McpToolDefinition): (...args: unknown[]) => unknown {
  const name = resolveToolDefinitionName(tool)
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

  return handler
}

/**
 * Invoke a wrapped tool handler with the same argument shape used by the MCP SDK.
 *
 * @internal
 */
export async function invokeWrappedToolHandler(
  tool: McpToolDefinition,
  handler: (...args: unknown[]) => unknown,
  input: unknown,
  extra: McpRequestExtra,
): Promise<McpToolCallbackResult> {
  if (tool.inputSchema !== undefined) {
    return await handler(input ?? {}, extra) as McpToolCallbackResult
  }

  return await handler(extra) as McpToolCallbackResult
}

/**
 * Register a tool from a McpToolDefinition
 * @internal
 */
export function registerToolFromDefinition(
  server: McpServer,
  tool: McpToolDefinition,
) {
  const name = resolveToolDefinitionName(tool)
  const { title } = enrichNameTitle({
    name: tool.name,
    title: tool.title,
    _meta: tool._meta,
    type: 'tool',
  })
  const handler = createWrappedToolHandler(tool)

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
