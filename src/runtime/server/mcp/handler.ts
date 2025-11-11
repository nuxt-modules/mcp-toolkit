import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './definitions'
import { registerToolFromDefinition, registerResourceFromDefinition, registerPromptFromDefinition } from './definitions'
import { sendRedirect, getHeader, readBody, defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { tools } from '#nuxt-mcp/tools.mjs'
import { resources } from '#nuxt-mcp/resources.mjs'
import { prompts } from '#nuxt-mcp/prompts.mjs'

async function createMcpServer(event: H3Event) {
  const config = useRuntimeConfig(event).mcp
  const { name, version } = config

  const server = new McpServer({
    name,
    version,
  })

  for (const tool of tools as McpToolDefinition[]) {
    registerToolFromDefinition(server, tool)
  }

  for (const resource of resources as McpResourceDefinition[]) {
    registerResourceFromDefinition(server, resource)
  }

  for (const prompt of prompts as McpPromptDefinition[]) {
    registerPromptFromDefinition(server, prompt)
  }

  return server
}

export default defineEventHandler(async (event: H3Event) => {
  const { browserRedirect } = useRuntimeConfig(event).mcp

  if (getHeader(event, 'accept')?.includes('text/html')) {
    return sendRedirect(event, browserRedirect)
  }

  const server = await createMcpServer(event)
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
