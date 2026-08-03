import { buildContext } from './context.ts'
import { toCompleteResult } from './results.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type {
  McpCompleteContext,
  McpCompleteResult,
  McpGetPromptResult,
  McpIcon,
  StandardTypedV1,
} from 'h3-mcp'
import type { McpContext } from './context.ts'
import type { McpPrompt } from './definition.ts'

type Schema = StandardTypedV1
type Awaitable<T> = T | Promise<T>

/**
 * What a prompt handler may return: the text of a single user message, or a
 * full result for multi-message conversations.
 */
export type McpPromptReturn = McpGetPromptResult | string

/**
 * One argument a prompt declares, with the completions clients offer for it as
 * the user types.
 */
export interface McpPromptArgumentDefinition {
  name: string
  title?: string
  description?: string
  required?: boolean
  complete?: (
    completing: McpCompleteContext,
    ctx: McpContext,
  ) => Awaitable<McpCompleteResult | string[]>
}

interface McpPromptMetadata {
  /** Derived from the filename when discovered. */
  name?: string
  title?: string
  description?: string
  /** Inferred from the subdirectory when discovered, e.g. `prompts/review/*`. */
  group?: string
  /** Free-form labels, advertised in `_meta` for clients to filter on. */
  tags?: string[]
  icons?: McpIcon[]
}

export interface McpPromptDefinition<Input extends Schema> extends McpPromptMetadata {
  /** A Standard Schema describing the prompt arguments. */
  inputSchema: Input
  handler: (args: StandardTypedV1.InferOutput<Input>, ctx: McpContext) => Awaitable<McpPromptReturn>
}

export interface McpPromptDefinitionWithArguments extends McpPromptMetadata {
  /**
   * Arguments declared one by one, for prompts that offer completions. The wire
   * only carries strings, so that is what the handler receives.
   */
  arguments: McpPromptArgumentDefinition[]
  handler: (args: Record<string, string>, ctx: McpContext) => Awaitable<McpPromptReturn>
}

export interface McpPromptDefinitionWithoutInput extends McpPromptMetadata {
  inputSchema?: undefined
  arguments?: undefined
  handler: (ctx: McpContext) => Awaitable<McpPromptReturn>
}

type AnyPromptDefinition =
  | McpPromptDefinition<Schema>
  | McpPromptDefinitionWithArguments
  | McpPromptDefinitionWithoutInput

function toPromptResult(value: McpPromptReturn): McpGetPromptResult {
  return typeof value === 'string'
    ? { messages: [{ role: 'user', content: { type: 'text', text: value } }] }
    : value
}

function hasArguments(
  definition: AnyPromptDefinition,
): definition is McpPromptDefinitionWithArguments {
  return 'arguments' in definition && definition.arguments !== undefined
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
 *
 * @example Arguments the client can autocomplete.
 * ```ts
 * export default defineMcpPrompt({
 *   arguments: [{ name: 'fruit', required: true, complete: ({ argument }) => fruits(argument.value) }],
 *   handler: ({ fruit }) => `You picked ${fruit}`,
 * })
 * ```
 */
export function defineMcpPrompt(definition: McpPromptDefinitionWithoutInput): McpPrompt
export function defineMcpPrompt(definition: McpPromptDefinitionWithArguments): McpPrompt
export function defineMcpPrompt<Input extends Schema>(
  definition: McpPromptDefinition<Input>,
): McpPrompt
export function defineMcpPrompt(definition: AnyPromptDefinition): McpPrompt {
  const { name, title, description, group, tags, icons } = definition

  return {
    kind: 'prompt',
    name,
    title,
    description,
    group,
    tags,
    build(identity, into) {
      const advertised = {
        name: identity.name,
        title: identity.title,
        description,
        icons,
        _meta: resolveMeta(identity.group, tags),
      }

      if (hasArguments(definition)) {
        const { handler } = definition
        into.prompts.push({
          ...advertised,
          arguments: definition.arguments.map(({ complete, ...argument }) => ({
            ...argument,
            ...(complete
              ? {
                  complete: async (completing: McpCompleteContext, event: H3Event) =>
                    toCompleteResult(await complete(completing, buildContext(event))),
                }
              : {}),
          })),
          handler: async (args: Record<string, string>, event: H3Event) =>
            toPromptResult(await handler(args, buildContext(event))),
        })
        return
      }

      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        into.prompts.push({
          ...advertised,
          arguments: inputSchema,
          handler: async (args: StandardTypedV1.InferOutput<Schema>, event: H3Event) =>
            toPromptResult(await handler(args, buildContext(event))),
        })
        return
      }

      const { handler } = definition
      into.prompts.push({
        ...advertised,
        handler: async (event: H3Event) => toPromptResult(await handler(buildContext(event))),
      })
    },
  }
}
