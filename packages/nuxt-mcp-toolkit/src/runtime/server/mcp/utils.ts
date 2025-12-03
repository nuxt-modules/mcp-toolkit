import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './definitions'
import { registerToolFromDefinition, registerResourceFromDefinition, registerPromptFromDefinition } from './definitions'
import { sendRedirect, getHeader, readBody, defineEventHandler, isError, send } from 'h3'
import type { H3Event, EventHandler, H3Error } from 'h3'
import { sendUnauthorized, sendForbidden } from './oauth/utils'

export interface McpHandlerConfig {
  name: string
  version: string
  browserRedirect: string
  tools?: McpToolDefinition[]
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
  /**
   * Middleware function that runs before MCP requests
   */
  middleware?: EventHandler
  /**
   * MCP route path (used for WWW-Authenticate header)
   */
  mcpRoute?: string
  /**
   * OAuth scopes required for this handler
   */
  requiredScopes?: string[]
}

export type CreateMcpHandlerConfig = McpHandlerConfig | ((event: H3Event) => McpHandlerConfig)

function resolveConfig(
  config: CreateMcpHandlerConfig,
  event: H3Event,
) {
  return typeof config === 'function' ? config(event) : config
}

function createMcpServer(config: {
  name: string
  version: string
  tools?: McpToolDefinition[]
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
}) {
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
    const mcpRoute = resolvedConfig.mcpRoute || '/mcp'
    const requiredScopes = resolvedConfig.requiredScopes?.join(' ')

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
    }

    // Execute middleware before processing MCP request
    // This can throw 401/403 errors to block unauthorized requests
    if (resolvedConfig.middleware) {
      try {
        await resolvedConfig.middleware(event)
      }
      catch (error) {
        // Handle authentication/authorization errors with proper WWW-Authenticate header
        if (isError(error)) {
          const h3Error = error as H3Error

          if (h3Error.statusCode === 401) {
            sendUnauthorized(event, {
              mcpRoute,
              scope: requiredScopes,
              error: 'invalid_token',
              errorDescription: h3Error.message || 'Authentication required',
            })
            // Send JSON error response and end the request
            return send(event, JSON.stringify({
              error: 'unauthorized',
              message: h3Error.message || 'Authentication required',
            }))
          }

          if (h3Error.statusCode === 403) {
            sendForbidden(event, {
              mcpRoute,
              requiredScope: requiredScopes,
              errorDescription: h3Error.message || 'Insufficient permissions',
            })
            // Send JSON error response and end the request
            return send(event, JSON.stringify({
              error: 'forbidden',
              message: h3Error.message || 'Insufficient permissions',
            }))
          }
        }

        // Re-throw other errors
        throw error
      }
    }

    const server = createMcpServer(resolvedConfig)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })

    event.node.res.on('close', () => {
      transport.close()
      server.close()
    })

    await server.connect(transport)
    const body = await readBody(event)
    await transport.handleRequest(event.node.req, event.node.res, body)
  })
}
