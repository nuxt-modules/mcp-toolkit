import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { McpToolDefinition } from '../utils/mcp'
import { registerToolFromDefinition } from '../utils/mcp'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import { tools } from '#nuxt-mcp/tools.mjs'

async function createMcpServer(event: H3Event) {
  const config = useRuntimeConfig(event).mcp
  const { name, version } = config

  const server = new McpServer({
    name,
    version,
  })

  console.log('tools', tools)

  for (const tool of tools as McpToolDefinition[]) {
    registerToolFromDefinition(server, tool)
  }

  return server
}

export default defineEventHandler(async (event) => {
  console.log('tools', tools)

  const { redirectTo } = useRuntimeConfig(event).mcp

  if (getHeader(event, 'accept')?.includes('text/html')) {
    return sendRedirect(event, redirectTo)
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
