import { describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { z } from 'zod'
import { createMcpServer } from '../src/runtime/server/mcp/utils'

vi.mock('#nuxt-mcp-toolkit/transport.mjs', () => ({
  default: vi.fn(),
}))

vi.mock('nitropack/runtime', () => ({
  defineCachedFunction: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

describe('Fallback registration', () => {
  it('allows registering definitions after empty fallback handlers are initialized', async () => {
    const server = createMcpServer({
      name: 'fallback-test-server',
      version: '1.0.0',
      browserRedirect: '/',
      tools: [],
      resources: [],
      prompts: [],
    })

    const client = new Client({
      name: 'fallback-test-client',
      version: '1.0.0',
    })

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    try {
      expect(await client.listTools()).toEqual({ tools: [] })
      expect(await client.listPrompts()).toEqual({ prompts: [] })
      expect(await client.listResources()).toEqual({ resources: [] })
      expect(await client.listResourceTemplates()).toEqual({ resourceTemplates: [] })

      server.registerTool('echo_tool', {
        description: 'Echo a message',
        inputSchema: {
          message: z.string(),
        },
      }, async ({ message }) => ({
        content: [{
          type: 'text',
          text: `Echo: ${message}`,
        }],
      }))

      server.registerPrompt('test_prompt', {
        description: 'Return a test prompt',
      }, async () => ({
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: 'Prompt message',
          },
        }],
      }))

      server.registerResource('test_resource', 'test://resource/only', {
        title: 'Test Resource',
        mimeType: 'text/plain',
      }, async (uri: URL) => ({
        contents: [{
          uri: uri.toString(),
          mimeType: 'text/plain',
          text: 'Resource content',
        }],
      }))

      const tools = await client.listTools()
      const prompts = await client.listPrompts()
      const resources = await client.listResources()

      expect(tools.tools.map(tool => tool.name)).toContain('echo_tool')
      expect(prompts.prompts.map(prompt => prompt.name)).toContain('test_prompt')
      expect(resources.resources.map(resource => resource.name)).toContain('test_resource')

      const toolResult = await client.callTool({
        name: 'echo_tool',
        arguments: {
          message: 'hello',
        },
      })

      expect(toolResult.isError).not.toBe(true)
      expect(toolResult.content).toEqual([{
        type: 'text',
        text: 'Echo: hello',
      }])

      const promptResult = await client.getPrompt({
        name: 'test_prompt',
      })

      expect(promptResult.messages).toEqual([{
        role: 'user',
        content: {
          type: 'text',
          text: 'Prompt message',
        },
      }])

      const resourceResult = await client.readResource({
        uri: 'test://resource/only',
      })

      expect(resourceResult.contents).toEqual([{
        uri: 'test://resource/only',
        mimeType: 'text/plain',
        text: 'Resource content',
      }])
    }
    finally {
      await Promise.all([
        client.close(),
        server.close(),
      ])
    }
  })
})
