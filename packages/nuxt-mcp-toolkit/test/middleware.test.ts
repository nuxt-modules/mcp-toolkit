import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, $fetch, url } from '@nuxt/test-utils/e2e'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { cleanupMcpTests, createMcpClient } from './helpers/mcp-setup.js'

describe('MCP Middleware', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/middleware', import.meta.url)),
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should render the page', async () => {
    const html = await $fetch('/')
    expect(html).toContain('<div>middleware</div>')
  })

  it('does not open a session store for a client-chosen session id when sessions are off', async () => {
    const response = await fetch(url('/mcp'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': globalThis.crypto.randomUUID(),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'session_tool', arguments: {} },
      }),
    })

    const { result } = await response.json()
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No active MCP session')
  })

  it('should execute middleware and pass context to tools', async () => {
    const client: Client = await createMcpClient('/mcp', 'test-middleware-client')

    try {
      // Call the tool - it should have access to context set by middleware
      const result = await client.callTool({
        name: 'context_tool',
        arguments: {},
      })

      expect(result).toBeDefined()
      const content = result.content as Array<{ type: string, text?: string }>
      const textContent = content.find(c => c.type === 'text')
      const contextData = JSON.parse(textContent!.text!)

      expect(contextData.userId).toBe('user-123')
      expect(contextData.middlewareExecuted).toBe(true)

      await client.close()
    }
    catch (error) {
      console.error('Failed to connect to MCP server:', error)
      await client.close()
      throw error
    }
  })
})
