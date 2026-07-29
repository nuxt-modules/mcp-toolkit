import { isInputRequiredResult } from '@modelcontextprotocol/server'
import { buildContext } from './context.ts'
import { toCallToolResult, toErrorResult } from './results.ts'
import { resolveIdentity, resolveMeta } from './validate.ts'
import type {
  CallToolResult,
  Icon,
  InputRequiredResult,
  ServerContext,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from '@modelcontextprotocol/server'
import type { McpContext } from './context.ts'
import type { McpTool } from './definition.ts'
import type { McpToolValue } from './results.ts'

type Schema = StandardSchemaWithJSON
type Awaitable<T> = T | Promise<T>

/**
 * What a tool handler may return: the shape described by `outputSchema` when
 * one is declared, any plain value otherwise, or a full protocol result.
 */
export type McpToolReturn<Output extends Schema | undefined> =
  | CallToolResult
  | InputRequiredResult
  | (Output extends Schema ? StandardSchemaWithJSON.InferInput<Output> : McpToolValue)

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
    args: StandardSchemaWithJSON.InferOutput<Input>,
    ctx: McpContext,
  ) => Awaitable<McpToolReturn<Output>>
}

export interface McpToolDefinitionWithoutInput<
  Output extends Schema | undefined = undefined,
> extends McpToolMetadata {
  inputSchema?: undefined
  outputSchema?: Output
  handler: (ctx: McpContext) => Awaitable<McpToolReturn<Output>>
}

async function settle(
  run: () => Awaitable<unknown>,
  hasOutputSchema: boolean,
): Promise<CallToolResult | InputRequiredResult> {
  try {
    const result = await run()
    // A multi-round-trip result must reach the client untouched.
    return isInputRequiredResult(result) ? result : toCallToolResult(result, hasOutputSchema)
  } catch (error) {
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
 *   handler: async ({ id }, ctx) => getUser(id, ctx.event),
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
  const { name, title, description, group, tags, annotations, icons, outputSchema } = definition
  const hasOutputSchema = outputSchema !== undefined

  return {
    kind: 'tool',
    name,
    title,
    description,
    group,
    tags,
    register(server, identity) {
      const resolved = resolveIdentity('tool', definition, identity)
      const config = {
        title: resolved.title,
        description,
        outputSchema,
        annotations,
        icons,
        _meta: resolveMeta(resolved.group, tags),
      }

      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        server.registerTool(resolved.name, { ...config, inputSchema }, (args, ctx: ServerContext) =>
          settle(() => handler(args, buildContext(ctx)), hasOutputSchema),
        )
        return
      }

      const { handler } = definition
      server.registerTool(resolved.name, config, (ctx: ServerContext) =>
        settle(() => handler(buildContext(ctx)), hasOutputSchema),
      )
    },
  }
}
