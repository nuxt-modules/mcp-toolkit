import { McpJsonRpcError } from 'h3-mcp'
import { attachNotify } from './context.ts'
import { isInputRequired, toCallToolResult, toErrorResult } from './results.ts'
import { requireScopes } from './scopes.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type {
  CallToolResult,
  Icon,
  InputRequiredResult,
  StandardTypedV1,
  ToolAnnotations,
} from 'h3-mcp'
import type { McpEvent } from './context.ts'
import type { McpTool } from './definition.ts'
import type { McpToolResult, McpToolValue } from './results.ts'

type Schema = StandardTypedV1
type Awaitable<T> = T | Promise<T>

/**
 * What a tool handler may return: the shape described by `outputSchema` when
 * one is declared, any plain value otherwise. Use `toolResult` for a full
 * protocol envelope alongside an output schema.
 */
export type McpToolReturn<Output extends Schema | undefined> =
  | McpToolResult
  | InputRequiredResult
  | (Output extends Schema ? StandardTypedV1.InferInput<Output> : McpToolValue | CallToolResult)

interface McpToolMetadata {
  /** Identifier the client calls. Derived from the filename when discovered. */
  name?: string
  /** Human-readable name shown in clients. */
  title?: string
  description?: string
  /** Inferred from the subdirectory when discovered, e.g. `tools/admin/*`. */
  group?: string
  /** Free-form labels, advertised in `_meta` for clients to filter on. */
  tags?: string[]
  /**
   * OAuth scopes the access token must all carry to call this tool. The tool
   * still appears in `tools/list`; a call without them is refused.
   *
   * @example
   * ```ts
   * defineMcpTool({ scopes: ['todos:write'], handler: … })
   * ```
   */
  scopes?: string[]
  annotations?: ToolAnnotations
  icons?: Icon[]
}

export interface McpToolDefinition<
  Input extends Schema,
  Output extends Schema | undefined = undefined,
> extends McpToolMetadata {
  /** A Standard Schema (Zod, Valibot, ArkType) describing the arguments. */
  inputSchema: Input
  /** Declaring one narrows the handler's return type and validates it. */
  outputSchema?: Output
  handler: (
    args: StandardTypedV1.InferOutput<Input>,
    event: McpEvent,
  ) => Awaitable<McpToolReturn<Output>>
}

export interface McpToolDefinitionWithoutInput<
  Output extends Schema | undefined = undefined,
> extends McpToolMetadata {
  inputSchema?: undefined
  outputSchema?: Output
  handler: (event: McpEvent) => Awaitable<McpToolReturn<Output>>
}

async function settle(
  run: () => Awaitable<unknown>,
  hasOutputSchema: boolean,
): Promise<CallToolResult | InputRequiredResult> {
  try {
    const result = await run()
    return isInputRequired(result) ? result : toCallToolResult(result, hasOutputSchema)
  } catch (error) {
    if (McpJsonRpcError.isMcpJsonRpcError(error)) throw error
    return toErrorResult(error)
  }
}

/**
 * Define an MCP tool: a function an AI client can call.
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   name: 'get-user',
 *   description: 'Fetch a user by id',
 *   inputSchema: z.object({ id: z.string() }),
 *   outputSchema: z.object({ name: z.string() }),
 *   handler: async ({ id }, event) => getUser(id, event),
 * })
 * ```
 */
export function defineMcpTool<Output extends Schema | undefined = undefined>(
  definition: McpToolDefinitionWithoutInput<Output>,
): McpTool
export function defineMcpTool<Input extends Schema, Output extends Schema | undefined = undefined>(
  definition: McpToolDefinition<Input, Output>,
): McpTool
export function defineMcpTool(
  definition:
    | McpToolDefinition<Schema, Schema | undefined>
    | McpToolDefinitionWithoutInput<Schema | undefined>,
): McpTool {
  const { name, title, description, group, tags, scopes, annotations, icons, outputSchema } =
    definition
  const hasOutputSchema = outputSchema !== undefined

  return {
    kind: 'tool',
    name,
    title,
    description,
    group,
    tags,
    scopes,
    build(identity, into, notify) {
      const advertised = {
        name: identity.name,
        title: identity.title,
        description,
        outputSchema,
        annotations,
        icons,
        _meta: resolveMeta(identity.group, tags, scopes),
      }

      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        into.tools.push({
          ...advertised,
          inputSchema,
          handler: (args: StandardTypedV1.InferOutput<Schema>, event: H3Event) =>
            settle(() => {
              requireScopes(event, scopes, 'tool', identity.name)
              return handler(args, attachNotify(event, notify))
            }, hasOutputSchema),
        })
        return
      }

      const { handler } = definition
      into.tools.push({
        ...advertised,
        handler: (event: H3Event) =>
          settle(() => {
            requireScopes(event, scopes, 'tool', identity.name)
            return handler(attachNotify(event, notify))
          }, hasOutputSchema),
      })
    },
  }
}
