import { attachNotify } from './context.ts'
import { resolveSchema } from './schema.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type { GetPromptResult, Icon, PromptArgument, StandardTypedV1 } from 'h3-mcp'
import type { McpEvent } from './context.ts'
import type { McpPrompt } from './definition.ts'

type Schema = StandardTypedV1
type Awaitable<T> = T | Promise<T>

/**
 * What a prompt handler may return: the text of a single user message, or a
 * full result for multi-message conversations.
 */
export type McpPromptReturn = GetPromptResult | string

interface McpPromptMetadata {
  /** Derived from the filename when discovered. */
  name?: string
  title?: string
  description?: string
  /** Inferred from the subdirectory when discovered, e.g. `prompts/review/*`. */
  group?: string
  /** Free-form labels, advertised in `_meta` for clients to filter on. */
  tags?: string[]
  icons?: Icon[]
}

export interface McpPromptDefinition<Input extends Schema> extends McpPromptMetadata {
  /** A Standard Schema describing the prompt arguments. */
  inputSchema: Input
  handler: (args: StandardTypedV1.InferOutput<Input>, event: McpEvent) => Awaitable<McpPromptReturn>
}

export interface McpPromptDefinitionWithArguments extends McpPromptMetadata {
  /**
   * The wire argument list. Use this instead of `inputSchema` when an
   * argument needs a `complete` callback.
   */
  arguments: PromptArgument[]
  handler: (args: Record<string, string>, event: McpEvent) => Awaitable<McpPromptReturn>
}

export interface McpPromptDefinitionWithoutInput extends McpPromptMetadata {
  inputSchema?: undefined
  arguments?: undefined
  handler: (event: McpEvent) => Awaitable<McpPromptReturn>
}

function toPromptResult(value: McpPromptReturn): GetPromptResult {
  return typeof value === 'string'
    ? { messages: [{ role: 'user', content: { type: 'text', text: value } }] }
    : value
}

/**
 * Define an MCP prompt: a reusable message template a client can expand.
 *
 * @example
 * ```ts
 * export default defineMcpPrompt({
 *   name: 'review-code',
 *   inputSchema: z.object({ path: z.string() }),
 *   handler: ({ path }) => `Review the code in ${path}.`,
 * })
 * ```
 */
export function defineMcpPrompt(definition: McpPromptDefinitionWithoutInput): McpPrompt
export function defineMcpPrompt(definition: McpPromptDefinitionWithArguments): McpPrompt
export function defineMcpPrompt<Input extends Schema>(
  definition: McpPromptDefinition<Input>,
): McpPrompt
export function defineMcpPrompt(
  definition:
    | McpPromptDefinition<Schema>
    | McpPromptDefinitionWithArguments
    | McpPromptDefinitionWithoutInput,
): McpPrompt {
  const { name, title, description, group, tags, icons } = definition

  return {
    kind: 'prompt',
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
        icons,
        _meta: resolveMeta(identity.group, tags),
      }

      if ('inputSchema' in definition && definition.inputSchema) {
        const { inputSchema, handler } = definition
        into.prompts.push({
          ...advertised,
          arguments: resolveSchema(inputSchema),
          handler: async (args: StandardTypedV1.InferOutput<Schema>, event: H3Event) =>
            toPromptResult(await handler(args, attachNotify(event, notify))),
        })
        return
      }

      if ('arguments' in definition && definition.arguments) {
        const { arguments: args, handler } = definition
        into.prompts.push({
          ...advertised,
          arguments: args,
          handler: async (parsed: Record<string, string>, event: H3Event) =>
            toPromptResult(await handler(parsed, attachNotify(event, notify))),
        })
        return
      }

      const { handler } = definition
      into.prompts.push({
        ...advertised,
        handler: async (event: H3Event) =>
          toPromptResult(await handler(attachNotify(event, notify))),
      })
    },
  }
}
