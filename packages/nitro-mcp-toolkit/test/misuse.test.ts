import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import { defineMcpTool } from '../src/runtime/index.ts'

// Definitions read the serving event from the scope `createMcpHandler` opens, so
// registering them on a hand-rolled server must fail with a message that says so
// rather than a confusing property access.
describe('registering a definition outside the toolkit handler', () => {
  it('explains that no MCP request is in scope', async () => {
    const server = new McpServer({ name: 'hand-rolled', version: '0.0.0' })
    defineMcpTool({ name: 'ping', handler: () => 'pong' }).register(server)

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)

    const client = new Client({ name: 'test', version: '0.0.0' })
    await client.connect(clientTransport)

    const result = await client.callTool({ name: 'ping' })
    expect(result.isError).toBe(true)
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('No MCP request in scope') },
    ])

    await client.close()
    await server.close()
  })
})
