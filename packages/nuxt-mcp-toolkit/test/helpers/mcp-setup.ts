import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { getServerLogs, url } from '@nuxt/test-utils/e2e'

let mcpClient: Client | undefined
let mcpUrl: URL | undefined

export function createMcpUrl(path = '/mcp') {
  const baseUrl = url('/')
  const baseUrlObj = new URL(baseUrl)
  const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
  return new URL(path, origin)
}

export async function setupMcpClient(mcpEndpointUrl: URL) {
  // Only create client once and reuse it
  if (mcpClient) {
    return mcpClient
  }

  mcpUrl = mcpEndpointUrl

  // Create MCP client
  mcpClient = new Client({
    name: 'test-client',
    version: '1.0.0',
  })

  const transport = new StreamableHTTPClientTransport(mcpEndpointUrl)
  try {
    await mcpClient.connect(transport)
  }
  catch (error) {
    throw new Error(`MCP connection failed. Server output:\n${getServerLogs().join('\n')}`, { cause: error })
  }

  if (!mcpClient) throw new Error('The MCP client has not connected.')
  return mcpClient
}

export async function cleanupMcpTests() {
  if (mcpClient) {
    await mcpClient.close()
    mcpClient = undefined
  }
  mcpUrl = undefined
}

export function getMcpClient() {
  if (!mcpClient) throw new Error('The MCP client has not connected.')
  return mcpClient
}

export function getMcpUrl() {
  return mcpUrl
}

export async function createMcpClient(path = '/mcp', name = 'test-client') {
  const client = new Client({
    name,
    version: '1.0.0',
  })

  await client.connect(new StreamableHTTPClientTransport(createMcpUrl(path)))

  return client
}
