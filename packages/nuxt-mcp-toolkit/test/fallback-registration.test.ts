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

async function withClient(config: Parameters<typeof createMcpServer>[0], run: (client: Client, server: Awaited<ReturnType<typeof createMcpServer>>) => Promise<void>) {
  const server = await createMcpServer(config)
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
    await run(client, server)
  }
  finally {
    await Promise.all([
      client.close(),
      server.close(),
    ])
  }
}

describe('Fallback registration', () => {
  it('returns empty discovery responses and not-found fetch errors for tools-only servers', async () => {
    await withClient({
      name: 'tools-only-server',
      version: '1.0.0',
      tools: [{
        name: 'echo_tool',
        description: 'Echo a message',
        inputSchema: {
          message: z.string(),
        },
        handler: async ({ message }) => ({
          content: [{
            type: 'text',
            text: `Echo: ${message}`,
          }],
        }),
      }],
      resources: [],
      prompts: [],
    }, async (client) => {
      const tools = await client.listTools()

      expect(tools.tools).toHaveLength(1)
      expect(tools.tools[0]?.name).toBe('echo_tool')
      expect(await client.listPrompts()).toEqual({ prompts: [] })
      expect(await client.listResources()).toEqual({ resources: [] })
      expect(await client.listResourceTemplates()).toEqual({ resourceTemplates: [] })

      await expect(client.getPrompt({
        name: 'missing_prompt',
      })).rejects.toMatchObject({
        message: expect.stringContaining('Prompt missing_prompt not found'),
      })

      await expect(client.readResource({
        uri: 'test://resource/missing',
      })).rejects.toMatchObject({
        message: expect.stringContaining('Resource test://resource/missing not found'),
      })
    })
  })

  it('returns empty discovery responses and tool errors for prompts-only servers', async () => {
    await withClient({
      name: 'prompts-only-server',
      version: '1.0.0',
      tools: [],
      resources: [],
      prompts: [{
        name: 'test_prompt',
        description: 'A prompt-only server test prompt',
        handler: async () => ({
          messages: [{
            role: 'user',
            content: {
              type: 'text',
              text: 'Prompt-only fixture message',
            },
          }],
        }),
      }],
    }, async (client) => {
      expect(await client.listTools()).toEqual({ tools: [] })

      const prompts = await client.listPrompts()
      expect(prompts.prompts).toHaveLength(1)
      expect(prompts.prompts[0]?.name).toBe('test_prompt')

      expect(await client.listResources()).toEqual({ resources: [] })
      expect(await client.listResourceTemplates()).toEqual({ resourceTemplates: [] })

      const result = await client.callTool({
        name: 'missing_tool',
        arguments: {},
      })

      expect(result.isError).toBe(true)
      expect(result.content).toEqual([{
        type: 'text',
        text: 'MCP error -32602: Tool missing_tool not found',
      }])
    })
  })

  it('returns empty discovery responses and reads resources for resources-only servers', async () => {
    await withClient({
      name: 'resources-only-server',
      version: '1.0.0',
      tools: [],
      resources: [{
        name: 'test_resource',
        uri: 'test://resource/only',
        metadata: {
          mimeType: 'text/plain',
        },
        handler: async (uri: URL) => ({
          contents: [{
            uri: uri.toString(),
            mimeType: 'text/plain',
            text: 'Resource-only fixture content',
          }],
        }),
      }],
      prompts: [],
    }, async (client) => {
      expect(await client.listTools()).toEqual({ tools: [] })
      expect(await client.listPrompts()).toEqual({ prompts: [] })

      const resources = await client.listResources()
      expect(resources.resources).toHaveLength(1)
      expect(resources.resources[0]?.name).toBe('test_resource')
      expect(await client.listResourceTemplates()).toEqual({ resourceTemplates: [] })

      expect(await client.readResource({
        uri: 'test://resource/only',
      })).toEqual({
        contents: [{
          uri: 'test://resource/only',
          mimeType: 'text/plain',
          text: 'Resource-only fixture content',
        }],
      })
    })
  })

  it('allows registering definitions after empty fallback handlers are initialized', async () => {
    await withClient({
      name: 'fallback-test-server',
      version: '1.0.0',
      tools: [],
      resources: [],
      prompts: [],
    }, async (client, server) => {
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
    })
  })
})
