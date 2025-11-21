import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

describe('Tools', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  beforeAll(async () => {
    const baseUrl = url('/')
    const baseUrlObj = new URL(baseUrl)
    const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
    const mcpUrl = new URL('/mcp', origin)
    await setupMcpClient(mcpUrl)
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should list tools via MCP client', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const tools = await client.listTools()

    expect(tools).toBeDefined()
    expect(tools.tools).toBeInstanceOf(Array)
    expect(tools.tools.length).toBeGreaterThan(0)
  })

  it('should include the test_tool in the tools list', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const tools = await client.listTools()
    const testTool = tools.tools.find(tool => tool.name === 'test_tool')

    expect(testTool, 'test_tool should be present in the tools list').toBeDefined()
    expect(testTool?.name, `Expected tool name to be 'test_tool', but got '${testTool?.name}'`).toBe('test_tool')
    expect(testTool?.description, `Expected description to match, but got '${testTool?.description}'`).toBe('A simple test tool for MCP testing')
  })

  it('should be able to call the test_tool', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const inputValue = 'Hello from test'

    const result = await client.callTool({
      name: 'test_tool',
      arguments: {
        input: inputValue,
      },
    })

    expect(result, 'Tool call should return a result').toBeDefined()
    expect(result.content, 'Result content should be an array').toBeInstanceOf(Array)
    const content = result.content as Array<{ type: string, text?: string }>
    expect(content.length, `Expected at least 1 content item, but got ${content.length}`).toBeGreaterThan(0)

    const textContent = content.find(c => c.type === 'text')
    expect(textContent, 'Result should contain text content').toBeDefined()
    expect(textContent?.text, `Expected text to contain 'Test result: Hello from test', but got '${textContent?.text}'`).toContain('Test result: Hello from test')
  })
})
