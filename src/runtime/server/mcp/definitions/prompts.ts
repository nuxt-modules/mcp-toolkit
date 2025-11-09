import type { z, ZodTypeAny, ZodType, ZodOptional, ZodTypeDef } from 'zod'
import type { GetPromptResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, PromptCallback } from '@modelcontextprotocol/sdk/server/mcp.js'

type PromptArgsRawShape = {
  [k: string]: ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>
}

/**
 * Callback type for MCP prompts, matching the SDK's PromptCallback type
 */
export type McpPromptCallback<Args extends PromptArgsRawShape | undefined = undefined> = Args extends PromptArgsRawShape
  ? (args: z.objectOutputType<Args, ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>
  : (extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => GetPromptResult | Promise<GetPromptResult>

/**
 * Definition of an MCP prompt matching the SDK's registerPrompt signature
 * This structure is identical to what you'd pass to server.registerPrompt()
 */
export interface McpPromptDefinition<Args extends PromptArgsRawShape | undefined = undefined> {
  name: string
  title?: string
  description?: string
  argsSchema?: Args
  handler: McpPromptCallback<Args>
}

/**
 * Helper function to register a prompt from a McpPromptDefinition
 */
export function registerPromptFromDefinition<Args extends PromptArgsRawShape | undefined = undefined>(
  server: McpServer,
  prompt: McpPromptDefinition<Args>,
) {
  if (prompt.argsSchema) {
    return server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema: prompt.argsSchema as PromptArgsRawShape,
      },
      prompt.handler as unknown as PromptCallback<PromptArgsRawShape>,
    )
  }
  else {
    return server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
      },
      prompt.handler as unknown as PromptCallback<PromptArgsRawShape>,
    )
  }
}

/**
 * Define an MCP prompt that will be automatically registered
 *
 * This function matches the exact structure of server.registerPrompt() from the MCP SDK,
 * making it easy to migrate code from the SDK to this module.
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
 *   argsSchema: {
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
export function defineMcpPrompt<const Args extends PromptArgsRawShape | undefined = undefined>(
  definition: McpPromptDefinition<Args>,
): McpPromptDefinition<Args> {
  return definition
}
