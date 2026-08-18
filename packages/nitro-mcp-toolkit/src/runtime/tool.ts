import { attachNotify } from './context.ts'
import { isInputRequired, toCallToolResult, toErrorResult } from './results.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type {
  McpCallToolResult,
  McpIcon,
  McpInputRequiredResult,
  McpToolAnnotations,
  StandardTypedV1,
} from 'h3-mcp'
import type { McpEvent } from './context.ts'
import type { McpTool } from './definition.ts'
import type { McpToolValue } from './results.ts'

type Schema = StandardTypedV1
type Awaitable<T> = T | Promise<T>

/**
 * What a tool handler may return: the shape described by `outputSchema` when
 * one is declared, any plain value otherwise, or a full protocol result.
 */
export type McpToolReturn<Output extends Schema | undefined> =
  | McpCallToolResult
  | McpInputRequiredResult
  | (Output extends Schema ? StandardTypedV1.InferInput<Output> : McpToolValue)

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
  annotations?: McpToolAnnotations
  icons?: McpIcon[]
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
): Promise<McpCallToolResult | McpInputRequiredResult> {
  try {
    const result = await run()
    return isInputRequired(result) ? result : toCallToolResult(result, hasOutputSchema)
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
  const { name, title, description, group, tags, annotations, icons, outputSchema } = definition
  const hasOutputSchema = outputSchema !== undefined

  return {
    kind: 'tool',
    name,
    title,
    description,
    group,
    tags,
    build(identity, into, notify) {
      const advertised = {
        name: identity.name,
        title: identity.title,
        description,
        outputSchema,
        annotations,
        icons,
        _meta: resolveMeta(identity.group, tags),
      }

      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        into.tools.push({
          ...advertised,
          inputSchema,
          handler: (args: StandardTypedV1.InferOutput<Schema>, event: H3Event) =>
            settle(() => handler(args, attachNotify(event, notify)), hasOutputSchema),
        })
        return
      }

      const { handler } = definition
      into.tools.push({
        ...advertised,
        handler: (event: H3Event) =>
          settle(() => handler(attachNotify(event, notify)), hasOutputSchema),
      })
    },
  }
}
