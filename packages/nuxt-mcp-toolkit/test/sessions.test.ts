import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

function createMcpUrl(path = '/mcp') {
  const baseUrl = url('/')
  const baseUrlObj = new URL(baseUrl)
  const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
  return new URL(path, origin)
}

describe('Session Management', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/sessions', import.meta.url)),
  })

  const clients: Client[] = []

  afterAll(async () => {
    for (const client of clients) {
      try {
        await client.close()
      }
      catch (error) {
        console.error('Failed to close client:', error)
      }
    }
  })

  async function createSessionClient() {
    const client = new Client({ name: 'session-test-client', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(createMcpUrl())
    await client.connect(transport)
    clients.push(client)
    return { client, transport }
  }

  it('should assign a session ID on initialization', async () => {
    const { transport } = await createSessionClient()
    expect(transport.sessionId).toBeDefined()
    expect(typeof transport.sessionId).toBe('string')
    expect(transport.sessionId!.length).toBeGreaterThan(0)
  })

  it('should maintain session across multiple tool calls', async () => {
    const { client, transport } = await createSessionClient()
    const sessionId = transport.sessionId

    const result1 = await client.callTool({ name: 'session_tool', arguments: { message: 'first' } })
    const result2 = await client.callTool({ name: 'session_tool', arguments: { message: 'second' } })

    expect(transport.sessionId).toBe(sessionId)

    const content1 = result1.content as Array<{ type: string, text?: string }>
    const content2 = result2.content as Array<{ type: string, text?: string }>
    expect(content1[0]?.text).toBe('Echo: first')
    expect(content2[0]?.text).toBe('Echo: second')
  })

  it('should support multiple independent sessions', async () => {
    const { transport: transport1 } = await createSessionClient()
    const { transport: transport2 } = await createSessionClient()

    expect(transport1.sessionId).toBeDefined()
    expect(transport2.sessionId).toBeDefined()
    expect(transport1.sessionId).not.toBe(transport2.sessionId)
  })

  it('should return 400 for malformed session ID', async () => {
    const mcpUrl = createMcpUrl()
    try {
      const response = await fetch(mcpUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'mcp-session-id': 'invalid-session-id',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 1,
        }),
      })
      expect(response.status).toBe(400)
    }
    catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      expect(message).toMatch(/400|404/)
    }
  })

  it('should reject cross-scheme origins even on the same host', async () => {
    const mcpUrl = createMcpUrl()
    const requestOrigin = `${mcpUrl.protocol}//${mcpUrl.host}`
    const crossSchemeOrigin = requestOrigin.startsWith('https://')
      ? requestOrigin.replace('https://', 'http://')
      : requestOrigin.replace('http://', 'https://')

    const response = await fetch(mcpUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Origin': crossSchemeOrigin,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    })

    expect(response.status).toBe(403)
  })

  it('should list tools within a session', async () => {
    const { client } = await createSessionClient()
    const tools = await client.listTools()

    expect(tools.tools).toBeInstanceOf(Array)
    const sessionTool = tools.tools.find(t => t.name === 'session_tool')
    expect(sessionTool).toBeDefined()
    expect(sessionTool?.description).toBe('A tool for testing session management')
  })

  it('should persist server-side state within a session across tool calls', async () => {
    const { client } = await createSessionClient()

    await client.callTool({ name: 'store_value', arguments: { key: 'color', value: 'blue' } })
    const result = await client.callTool({ name: 'get_value', arguments: { key: 'color' } })

    const content = result.content as Array<{ type: string, text?: string }>
    expect(content[0]?.text).toBe('blue')
  })

  it('should isolate session state between different sessions', async () => {
    const { client: client1 } = await createSessionClient()
    const { client: client2 } = await createSessionClient()

    await client1.callTool({ name: 'store_value', arguments: { key: 'secret', value: 'session1-only' } })
    const result = await client2.callTool({ name: 'get_value', arguments: { key: 'secret' } })

    const content = result.content as Array<{ type: string, text?: string }>
    expect(content[0]?.text).toBe('NOT_FOUND')
  })

  it('should invalidate the session after the current middleware request completes', async () => {
    const { transport } = await createSessionClient()
    const sessionId = transport.sessionId
    expect(sessionId).toBeDefined()

    const invalidateUrl = createMcpUrl('/mcp?invalidateSession=1')
    const currentResponse = await fetch(invalidateUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    })

    expect(currentResponse.status).toBe(200)

    const nextResponse = await fetch(createMcpUrl().toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2,
      }),
    })

    expect(nextResponse.status).toBe(404)
  })
})
