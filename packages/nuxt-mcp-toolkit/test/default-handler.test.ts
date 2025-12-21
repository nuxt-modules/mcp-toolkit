import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, $fetch, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { cleanupMcpTests } from './helpers/mcp-setup.js'

describe('Default Handler Override', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/default-handler', import.meta.url)),
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should render the page', async () => {
    const html = await $fetch('/')
    expect(html).toContain('<div>default-handler</div>')
  })

  it('should redirect browser requests to custom redirect path', async () => {
    // The default handler has browserRedirect: '/custom-redirect'
    try {
      await $fetch('/mcp', {
        headers: {
          Accept: 'text/html',
        },
        redirect: 'manual',
      })
    }
    catch (error: unknown) {
      // Expect a redirect (302) to /custom-redirect
      const httpError = error as { response?: Response }
      if (httpError.response) {
        expect(httpError.response.status).toBe(302)
        expect(httpError.response.headers.get('location')).toBe('/custom-redirect')
      }
    }
  })

  it('should use default handler config with global tools', async () => {
    const baseUrl = url('/')
    const baseUrlObj = new URL(baseUrl)
    const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
    const mcpUrl = new URL('/mcp', origin)

    const client = new Client({
      name: 'test-default-handler-client',
      version: '1.0.0',
    })

    try {
      const transport = new StreamableHTTPClientTransport(mcpUrl)
      await client.connect(transport)

      // List tools - should include global tools even though default handler doesn't specify them
      const tools = await client.listTools()
      expect(tools.tools.length).toBeGreaterThan(0)

      const myTool = tools.tools.find(tool => tool.name === 'my_tool')
      expect(myTool, 'my_tool should be present').toBeDefined()

      // Call the tool
      const result = await client.callTool({
        name: 'my_tool',
        arguments: {
          message: 'Hello from default handler test',
        },
      })

      expect(result).toBeDefined()
      expect(result.content).toBeInstanceOf(Array)
      const content = result.content as Array<{ type: string, text?: string }>
      const textContent = content.find(c => c.type === 'text')
      expect(textContent?.text).toContain('My tool says: Hello from default handler test')

      await client.close()
    }
    catch (error) {
      console.error('Failed to connect to MCP server:', error)
      await client.close()
      throw error
    }
  })
})
