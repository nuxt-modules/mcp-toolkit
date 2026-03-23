import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'

/**
 * Extra arguments passed to MCP tool, prompt, and resource handlers by the SDK.
 * Provides access to the abort signal, auth info, session ID, and request metadata.
 *
 * This is `RequestHandlerExtra<ServerRequest, ServerNotification>` from `@modelcontextprotocol/sdk`.
 */
export type McpRequestExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

/**
 * @deprecated Use {@link McpRequestExtra} instead.
 */
export type McpToolExtra = McpRequestExtra

/**
 * @deprecated Use {@link McpRequestExtra} instead.
 */
export type McpPromptExtra = McpRequestExtra

/**
 * @deprecated Use {@link McpRequestExtra} instead.
 */
export type McpResourceExtra = McpRequestExtra
