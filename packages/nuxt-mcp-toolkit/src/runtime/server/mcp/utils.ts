import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './definitions'
import { registerToolFromDefinition, registerResourceFromDefinition, registerPromptFromDefinition } from './definitions'
import { sendRedirect, getHeader, readBody, defineEventHandler } from 'h3'
import type { H3Event } from 'h3'

export type CreateMcpHandlerConfig
  = {
    name: string
    version: string
    browserRedirect: string
    tools?: McpToolDefinition[]
    resources?: McpResourceDefinition[]
    prompts?: McpPromptDefinition[]
  }
  | ((event: H3Event) => {
    name: string
    version: string
    browserRedirect: string
    tools?: McpToolDefinition[]
    resources?: McpResourceDefinition[]
    prompts?: McpPromptDefinition[]
  })

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

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
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
