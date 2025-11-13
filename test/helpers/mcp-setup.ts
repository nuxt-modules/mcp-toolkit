import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

let mcpClient: Client | undefined
let mcpUrl: URL | undefined

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

  // Try to connect - if it fails, we'll skip the MCP-specific tests
  try {
    const transport = new StreamableHTTPClientTransport(mcpEndpointUrl)
    await mcpClient.connect(transport)
  }
  catch (error) {
    // If connection fails, we'll skip MCP tests but continue with basic endpoint test
    console.error('Failed to connect to MCP server:', error)
    mcpClient = undefined
  }

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
  return mcpClient
}

export function getMcpUrl() {
  return mcpUrl
}
