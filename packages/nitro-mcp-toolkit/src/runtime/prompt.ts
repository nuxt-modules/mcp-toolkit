import { buildContext } from './context'
import { noArguments } from './schema'
import type {
  GetPromptResult,
  Icon,
  ServerContext,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server'
import type { McpContext } from './context'
import type { McpPrompt } from './definition'

type Schema = StandardSchemaWithJSON
type Awaitable<T> = T | Promise<T>

/**
 * What a prompt handler may return: the text of a single user message, or a
 * full result for multi-message conversations.
 */
export type McpPromptReturn = GetPromptResult | string

interface McpPromptMetadata {
  name: string
  title?: string
  description?: string
  icons?: Icon[]
}

export interface McpPromptDefinition<Input extends Schema> extends McpPromptMetadata {
  /** A Standard Schema describing the prompt arguments. */
  inputSchema: Input
  handler: (
    args: StandardSchemaWithJSON.InferOutput<Input>,
    ctx: McpContext,
  ) => Awaitable<McpPromptReturn>
}

export interface McpPromptDefinitionWithoutInput extends McpPromptMetadata {
  inputSchema?: undefined
  handler: (ctx: McpContext) => Awaitable<McpPromptReturn>
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
export function defineMcpPrompt<Input extends Schema>(
  definition: McpPromptDefinition<Input>,
): McpPrompt
export function defineMcpPrompt(
  definition: McpPromptDefinition<Schema> | McpPromptDefinitionWithoutInput,
): McpPrompt {
  const { name, title, description, icons } = definition
  const config = { title, description, icons }

  return {
    kind: 'prompt',
    name,
    title,
    description,
    register(server) {
      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        server.registerPrompt(
          name,
          { ...config, argsSchema: inputSchema },
          async (args, ctx: ServerContext) =>
            toPromptResult(await handler(args, buildContext(ctx))),
        )
        return
      }

      const { handler } = definition
      server.registerPrompt(
        name,
        { ...config, argsSchema: noArguments },
        async (_args, ctx: ServerContext) => toPromptResult(await handler(buildContext(ctx))),
      )
    },
  }
}
