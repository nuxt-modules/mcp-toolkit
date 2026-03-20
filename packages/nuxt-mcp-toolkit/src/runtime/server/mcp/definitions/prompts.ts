import type { H3Event } from 'h3'
import type { ZodRawShape } from 'zod'
import type { GetPromptResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { McpServer, PromptCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { enrichNameTitle } from './utils'

/**
 * Return type for MCP prompt handlers.
 * Accepts a full `GetPromptResult` or a plain string (auto-wrapped into a single user message).
 */
export type McpPromptCallbackResult = GetPromptResult | string

/**
 * Extra arguments passed to MCP prompt handlers by the SDK.
 * Provides access to the abort signal, auth info, session ID, and request metadata.
 */
export type McpPromptExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

/**
 * Callback type for MCP prompts, matching the SDK's PromptCallback type.
 * Handlers may return a full `GetPromptResult` or a simple string.
 */
export type McpPromptCallback<Args extends ZodRawShape | undefined = undefined> = Args extends ZodRawShape
  ? (args: ShapeOutput<Args>, extra: McpPromptExtra) => McpPromptCallbackResult | Promise<McpPromptCallbackResult>
  : (extra: McpPromptExtra) => McpPromptCallbackResult | Promise<McpPromptCallbackResult>

/**
 * Definition of an MCP prompt
 * Uses `inputSchema` for consistency with tools, which is mapped to `argsSchema` when registering with the SDK
 */
export interface McpPromptDefinition<Args extends ZodRawShape | undefined = undefined> {
  name?: string
  title?: string
  description?: string
  /**
   * Functional group this prompt belongs to (e.g. `'onboarding'`, `'debugging'`).
   * Auto-inferred from directory structure when omitted.
   * @see https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1300
   */
  group?: string
  /**
   * Free-form tags for filtering and categorization.
   * @see https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1300
   */
  tags?: string[]
  /**
   * Default role used when the handler returns a plain string.
   * @default 'user'
   */
  role?: 'user' | 'assistant'
  inputSchema?: Args
  _meta?: Record<string, unknown>
  handler: McpPromptCallback<Args>
  /**
   * Guard that controls whether this prompt is registered for a given request.
   * Receives the H3 event (with `event.context` populated by middleware) and
   * returns `true` to include the prompt or `false` to hide it.
   */
  enabled?: (event: H3Event) => boolean | Promise<boolean>
}

/**
 * Normalize a prompt handler result: pass through `GetPromptResult` objects
 * unchanged, wrap plain strings into a single message with the given role.
 * @internal
 */
export function normalizePromptResult(result: McpPromptCallbackResult, role: 'user' | 'assistant' = 'user'): GetPromptResult {
  if (typeof result === 'string') {
    return {
      messages: [{ role, content: { type: 'text', text: result } }],
    }
  }
  return result
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

  // Resolve group/tags for internal consistency. The MCP SDK does not
  // currently expose _meta on prompts, but the resolved values are kept
  // on the definition object for internal consumers (e.g. search-tools).
  const group = prompt.group ?? (prompt._meta?.group as string | undefined)
  if (group != null || prompt.tags?.length) {
    prompt._meta = {
      ...prompt._meta,
      ...(group != null && { group }),
      ...(prompt.tags?.length && { tags: prompt.tags }),
    }
  }

  const role = prompt.role ?? 'user'
  const wrappedHandler: PromptCallback<ZodRawShape> = async (...args: unknown[]) => {
    const result = await (prompt.handler as (...a: unknown[]) => unknown)(...args)
    return normalizePromptResult(result as McpPromptCallbackResult, role)
  }

  if (prompt.inputSchema) {
    return server.registerPrompt(
      name,
      {
        title,
        description: prompt.description,
        argsSchema: prompt.inputSchema as ZodRawShape,
      },
      wrappedHandler,
    )
  }
  else {
    return server.registerPrompt(
      name,
      {
        title,
        description: prompt.description,
      },
      wrappedHandler,
    )
  }
}

/**
 * Define an MCP prompt that will be automatically registered.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * Handlers can return a full `GetPromptResult` or a simple string
 * which is automatically wrapped into a single user message.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/prompts
 *
 * @example
 * ```ts
 * // Simple string return (defaults to 'user' role)
 * export default defineMcpPrompt({
 *   description: 'Code review assistant',
 *   handler: async () => 'You are a helpful assistant that helps with code review.',
 * })
 *
 * // String return with 'assistant' role
 * export default defineMcpPrompt({
 *   role: 'assistant',
 *   handler: async () => 'I am a code review assistant...',
 * })
 *
 * // Full GetPromptResult return
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
