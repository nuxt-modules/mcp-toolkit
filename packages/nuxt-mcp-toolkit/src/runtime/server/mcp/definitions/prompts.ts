import type { z, ZodTypeAny, ZodRawShape } from 'zod'
import type { GetPromptResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, PromptCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { enrichNameTitle } from './utils'

/**
 * Callback type for MCP prompts, matching the SDK's PromptCallback type
 */
export type McpPromptCallback<Args extends ZodRawShape | undefined = undefined> = Args extends ZodRawShape
  ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>
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
 * Helper function to register a prompt from a McpPromptDefinition
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
 * Define an MCP prompt that will be automatically registered
 *
 * If `name` or `title` are not provided, they will be automatically generated from the filename
 * (e.g., `list_documentation.ts` → `name: 'list-documentation'`, `title: 'List Documentation'`).
 *
 * @example
 * ```ts
 * // server/mcp/prompts/my-prompt.ts
 * import { z } from 'zod'
 *
 * export default defineMcpPrompt({
 *   name: 'summarize',
 *   title: 'Text Summarizer',
 *   description: 'Summarize any text using an LLM',
 *   inputSchema: {
 *     text: z.string().describe('The text to summarize'),
 *     maxLength: z.string().optional().describe('Maximum length of summary')
 *   },
 *   handler: async ({ text, maxLength }) => {
 *     const summary = await summarizeText(text, maxLength ? parseInt(maxLength) : undefined)
 *     return {
 *       messages: [{
 *         role: 'user',
 *         content: {
 *           type: 'text',
 *           text: summary
 *         }
 *       }]
 *     }
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * // Simple prompt without arguments
 * export default defineMcpPrompt({
 *   name: 'greeting',
 *   description: 'Generate a greeting message',
 *   handler: async () => {
 *     return {
 *       messages: [{
 *         role: 'user',
 *         content: {
 *           type: 'text',
 *           text: 'Hello! How can I help you today?'
 *         }
 *       }]
 *     }
 *   }
 * })
 * ```
 */
export function defineMcpPrompt<const Args extends ZodRawShape | undefined = undefined>(
  definition: McpPromptDefinition<Args>,
): McpPromptDefinition<Args> {
  return definition
}
