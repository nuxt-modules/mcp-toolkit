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

describe('Mid-Session Registration', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/mid-session-registration', import.meta.url)),
  })

  const clients: Client[] = []

  afterAll(async () => {
    for (const client of clients) {
      try {
        await client.close()
      }
      catch { /* ignore cleanup errors */ }
    }
  })

  async function createSessionClient() {
    const client = new Client({ name: 'mid-session-test', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(createMcpUrl())
    await client.connect(transport)
    clients.push(client)
    return client
  }

  it('should list initial tools without dynamic ones', async () => {
    const client = await createSessionClient()
    const { tools } = await client.listTools()
    const names = tools.map(t => t.name)
    expect(names).toContain('base_tool')
    expect(names).toContain('register_dynamic')
    expect(names).toContain('remove_dynamic')
    expect(names).not.toContain('my_dynamic_tool')
  })

  it('should register a tool mid-session and list it', async () => {
    const client = await createSessionClient()

    const result = await client.callTool({
      name: 'register_dynamic',
      arguments: { toolName: 'my_dynamic_tool' },
    })
    const content = result.content as Array<{ type: string, text?: string }>
    expect(content[0]?.text).toBe('registered my_dynamic_tool')

    const { tools } = await client.listTools()
    const names = tools.map(t => t.name)
    expect(names).toContain('my_dynamic_tool')
  })

  it('should call a dynamically registered tool', async () => {
    const client = await createSessionClient()

    await client.callTool({
      name: 'register_dynamic',
      arguments: { toolName: 'callable_tool' },
    })

    const result = await client.callTool({
      name: 'callable_tool',
      arguments: {},
    })
    const content = result.content as Array<{ type: string, text?: string }>
    expect(content[0]?.text).toBe('hello from callable_tool')
  })

  it('should remove a dynamically registered tool', async () => {
    const client = await createSessionClient()

    await client.callTool({
      name: 'register_dynamic',
      arguments: { toolName: 'temp_tool' },
    })

    let { tools } = await client.listTools()
    expect(tools.map(t => t.name)).toContain('temp_tool')

    const removeResult = await client.callTool({
      name: 'remove_dynamic',
      arguments: { toolName: 'temp_tool' },
    })
    const content = removeResult.content as Array<{ type: string, text?: string }>
    expect(content[0]?.text).toBe('removed temp_tool')

    ;({ tools } = await client.listTools())
    expect(tools.map(t => t.name)).not.toContain('temp_tool')
  })

  it('should not affect other sessions when registering tools', async () => {
    const client1 = await createSessionClient()
    const client2 = await createSessionClient()

    await client1.callTool({
      name: 'register_dynamic',
      arguments: { toolName: 'session1_only' },
    })

    const { tools: tools1 } = await client1.listTools()
    const { tools: tools2 } = await client2.listTools()

    expect(tools1.map(t => t.name)).toContain('session1_only')
    expect(tools2.map(t => t.name)).not.toContain('session1_only')
  })
})
