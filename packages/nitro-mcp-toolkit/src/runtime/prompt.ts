import { buildContext } from './context.ts'
import { noArguments } from './schema.ts'
import { resolveIdentity, resolveMeta } from './validate.ts'
import type {
  GetPromptResult,
  Icon,
  ServerContext,
  StandardSchemaWithJSON,
} from '@modelcontextprotocol/server'
import type { McpContext } from './context.ts'
import type { McpPrompt } from './definition.ts'

type Schema = StandardSchemaWithJSON
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
  const { name, title, description, group, tags, icons } = definition

  return {
    kind: 'prompt',
    name,
    title,
    description,
    group,
    tags,
    register(server, identity) {
      const resolved = resolveIdentity('prompt', definition, identity)
      const config = {
        title: resolved.title,
        description,
        icons,
        _meta: resolveMeta(resolved.group, tags),
      }

      if (definition.inputSchema) {
        const { inputSchema, handler } = definition
        server.registerPrompt(
          resolved.name,
          { ...config, argsSchema: inputSchema },
          async (args, ctx: ServerContext) =>
            toPromptResult(await handler(args, buildContext(ctx))),
        )
        return
      }

      const { handler } = definition
      server.registerPrompt(
        resolved.name,
        { ...config, argsSchema: noArguments },
        async (_args, ctx: ServerContext) => toPromptResult(await handler(buildContext(ctx))),
      )
    },
  }
}
