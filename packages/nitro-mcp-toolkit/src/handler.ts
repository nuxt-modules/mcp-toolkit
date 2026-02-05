import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sendRedirect, getHeader, defineEventHandler, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition, McpMiddleware, McpHandlerOptions } from './definitions'
import { registerToolFromDefinition, registerResourceFromDefinition, registerPromptFromDefinition } from './definitions'
import type { McpTransportHandler } from './providers/types'
import { getMcpConfig, type McpConfig } from './config'

export type { McpTransportHandler }
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

export interface CreateMcpEventHandlerOptions {
  transport: McpTransportHandler
}

export function createMcpEventHandler(
  config: CreateMcpHandlerConfig,
  options: CreateMcpEventHandlerOptions,
) {
  return defineEventHandler(async (event: H3Event) => {
    const resolvedConfig = resolveConfig(config, event)

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
    }

    const handler = async () => {
      const server = createMcpServer(resolvedConfig)
      return options.transport(server, event)
    }

    // If middleware is defined, wrap the handler with it
    if (resolvedConfig.middleware) {
      // Track if next() was called by the middleware
      let nextCalled = false
      let handlerResult: Response | undefined

      const next = async () => {
        nextCalled = true
        handlerResult = await handler() as Response | undefined
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

/**
 * Create the main MCP handler that resolves configuration from virtual modules
 */
export interface CreateMainMcpHandlerOptions {
  transport: McpTransportHandler
  runtimeConfig: Partial<McpConfig>
  tools: McpToolDefinition[]
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
  handlers: McpHandlerOptions[]
  defaultHandler: McpHandlerOptions | null
}

export function createMainMcpHandler(options: CreateMainMcpHandlerOptions) {
  return createMcpEventHandler((event: H3Event) => {
    const config = getMcpConfig(options.runtimeConfig)
    const handlerName = getRouterParam(event, 'handler')

    // Custom handler via /mcp/:handler
    if (handlerName) {
      const handlerDef = options.handlers.find(h => h.name === handlerName)

      if (!handlerDef) {
        throw new Error(`Handler "${handlerName}" not found`)
      }

      return {
        name: handlerDef.name ?? handlerName,
        version: handlerDef.version ?? config.version,
        browserRedirect: handlerDef.browserRedirect ?? config.browserRedirect,
        tools: handlerDef.tools,
        resources: handlerDef.resources,
        prompts: handlerDef.prompts,
        middleware: handlerDef.middleware,
      }
    }

    // Default handler override via server/mcp/index.ts
    if (options.defaultHandler) {
      return {
        name: options.defaultHandler.name ?? config.name ?? 'MCP Server',
        version: options.defaultHandler.version ?? config.version,
        browserRedirect: options.defaultHandler.browserRedirect ?? config.browserRedirect,
        // Use handler's definitions if specified, otherwise use global definitions
        tools: options.defaultHandler.tools ?? options.tools,
        resources: options.defaultHandler.resources ?? options.resources,
        prompts: options.defaultHandler.prompts ?? options.prompts,
        middleware: options.defaultHandler.middleware,
      }
    }

    // Default behavior: expose all global tools, resources, and prompts
    return {
      name: config.name || 'MCP Server',
      version: config.version,
      browserRedirect: config.browserRedirect,
      tools: options.tools,
      resources: options.resources,
      prompts: options.prompts,
    }
  }, { transport: options.transport })
}
