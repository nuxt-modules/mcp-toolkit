import type { ZodRawShape } from 'zod'
import type { GetPromptResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, PromptCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { enrichNameTitle } from './utils'

/**
 * Callback type for MCP prompts, matching the SDK's PromptCallback type
 */
export type McpPromptCallback<Args extends ZodRawShape | undefined = undefined> = Args extends ZodRawShape
  ? (args: ShapeOutput<Args>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>
  : (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>

/**
 * Definition of an MCP prompt
 * Uses `inputSchema` for consistency with tools, which is mapped to `argsSchema` when registering with the SDK
 */
export interface McpPromptDefinition<Args extends ZodRawShape | undefined = undefined> {
  name?: string
  title?: string
  description?: string
  inputSchema?: Args
  _meta?: Record<string, unknown>
  handler: McpPromptCallback<Args>
}

/**
 * Register a prompt from a McpPromptDefinition
 * @internal
 */
export function registerPromptFromDefinition<Args extends ZodRawShape | undefined = undefined>(
  server: McpServer,
  prompt: McpPromptDefinition<Args>,
) {
  const { name, title } = enrichNameTitle({
    name: prompt.name,
    title: prompt.title,
    _meta: prompt._meta,
    type: 'prompt',
  })

  if (prompt.inputSchema) {
    return server.registerPrompt(
      name,
      {
        title,
        description: prompt.description,
        argsSchema: prompt.inputSchema as ZodRawShape,
      },
      prompt.handler as unknown as PromptCallback<ZodRawShape>,
    )
  }
  else {
    return server.registerPrompt(
      name,
      {
        title,
        description: prompt.description,
      },
      prompt.handler as unknown as PromptCallback<ZodRawShape>,
    )
  }
}

/**
 * Define an MCP prompt that will be automatically registered.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/prompts
 *
 * @example
 * ```ts
 * export default defineMcpPrompt({
 *   description: 'Generate a greeting message',
 *   handler: async () => ({
 *     messages: [{ role: 'user', content: { type: 'text', text: 'Hello!' } }]
 *   })
 * })
 * ```
 */
export function defineMcpPrompt<const Args extends ZodRawShape | undefined = undefined>(
  definition: McpPromptDefinition<Args>,
): McpPromptDefinition<Args> {
  return definition
}
