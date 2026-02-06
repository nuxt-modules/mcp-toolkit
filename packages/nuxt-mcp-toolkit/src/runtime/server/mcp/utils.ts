import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sendRedirect, getHeader, defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition, McpMiddleware } from './definitions'
import { registerToolFromDefinition, registerResourceFromDefinition, registerPromptFromDefinition } from './definitions'
// @ts-expect-error - Generated template that re-exports from provider
import handleMcpRequest from '#nuxt-mcp-toolkit/transport.mjs'

export type { McpTransportHandler } from './providers/types'
export { createMcpTransportHandler } from './providers/types'

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

export function createMcpServer(config: ResolvedMcpConfig): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version,
  })

  for (const tool of (config.tools || []) as McpToolDefinition[]) {
    registerToolFromDefinition(server, tool)
  }

  for (const resource of (config.resources || []) as McpResourceDefinition[]) {
    registerResourceFromDefinition(server, resource)
  }

  for (const prompt of (config.prompts || []) as McpPromptDefinition[]) {
    registerPromptFromDefinition(server, prompt)
  }

  return server
}

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
