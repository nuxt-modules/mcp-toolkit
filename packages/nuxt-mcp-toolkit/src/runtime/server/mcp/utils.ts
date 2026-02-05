import { sendRedirect, getHeader, defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition, McpMiddleware } from './definitions'
// @ts-expect-error - Generated template that re-exports from provider
import handleMcpRequest from '#nuxt-mcp/transport.mjs'

// Import createMcpServer for internal use
import { createMcpServer } from 'nitro-mcp-toolkit/handler'

// Re-export from nitro-mcp-toolkit
export { createMcpServer, createMcpTransportHandler } from 'nitro-mcp-toolkit/handler'
export type { McpTransportHandler } from 'nitro-mcp-toolkit/handler'

export interface ResolvedMcpConfig {
  name: string
  version: string
  browserRedirect: string
  tools?: McpToolDefinition[]
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
  middleware?: McpMiddleware
}

export type CreateMcpHandlerConfig = ResolvedMcpConfig | ((event: H3Event) => ResolvedMcpConfig)

function resolveConfig(config: CreateMcpHandlerConfig, event: H3Event): ResolvedMcpConfig {
  return typeof config === 'function' ? config(event) : config
}

/**
 * Create an MCP handler for Nuxt
 * Uses the Nuxt-specific transport template
 */
export function createMcpHandler(config: CreateMcpHandlerConfig) {
  return defineEventHandler(async (event: H3Event) => {
    const resolvedConfig = resolveConfig(config, event)

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
    }

    const handler = async () => {
      const server = createMcpServer(resolvedConfig)
      return handleMcpRequest(server, event)
    }

    // If middleware is defined, wrap the handler with it
    if (resolvedConfig.middleware) {
      // Track if next() was called by the middleware
      let nextCalled = false
      let handlerResult: Response | undefined

      const next = async () => {
        nextCalled = true
        handlerResult = await handler()
        return handlerResult
      }

      const middlewareResult = await resolvedConfig.middleware(event, next)

      // If middleware returned a result (from next()), use it
      if (middlewareResult !== undefined) {
        return middlewareResult
      }

      // If next() was called but middleware didn't return the result, use the handler result
      if (nextCalled) {
        return handlerResult
      }

      // If next() was never called, call the handler automatically
      return handler()
    }

    return handler()
  })
}
