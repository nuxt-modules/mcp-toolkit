import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, $fetch, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { cleanupMcpTests } from './helpers/mcp-setup.js'

describe('Handler', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should have the custom handler endpoint accessible', async () => {
    // Try to fetch the custom handler endpoint
    try {
      await $fetch('/mcp/test_handler', {
        headers: {
          Accept: 'application/json',
        },
      })
    }
    catch (error: unknown) {
      // The endpoint might return an error for non-MCP requests, but it should exist
      // We just need to verify it's not a 404
      const httpError = error as { statusCode?: number }
      expect(httpError.statusCode).not.toBe(404)
    }
  })

  it('should be able to use the custom handler', async () => {
    // Create a client for the custom handler endpoint
    const baseUrl = url('/')
    const baseUrlObj = new URL(baseUrl)
    const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
    const handlerUrl = new URL('/mcp/test_handler', origin)

    const handlerClient = new Client({
      name: 'test-handler-client',
      version: '1.0.0',
    })

    try {
      const transport = new StreamableHTTPClientTransport(handlerUrl)
      await handlerClient.connect(transport)

      // List tools from the handler
      const tools = await handlerClient.listTools()
      expect(tools.tools.length).toBeGreaterThan(0)

      const handlerTool = tools.tools.find(tool => tool.name === 'test_handler_tool')
      expect(handlerTool, 'test_handler_tool should be present').toBeDefined()

      // Call the handler tool
      const result = await handlerClient.callTool({
        name: 'test_handler_tool',
        arguments: {
          message: 'Hello from handler test',
        },
      })

      expect(result, 'Handler tool call should return a result').toBeDefined()
      expect(result.content).toBeInstanceOf(Array)
      const content = result.content as Array<{ type: string, text?: string }>
      expect(content.length).toBeGreaterThan(0)

      const textContent = content.find(c => c.type === 'text')
      expect(textContent?.text).toContain('Handler echo: Hello from handler test')

      await handlerClient.close()
    }
    catch (error) {
      console.error('Failed to connect to custom handler:', error)
      await handlerClient.close()
      throw error
    }
  })
})
