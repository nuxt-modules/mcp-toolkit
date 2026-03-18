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

async function withClient(config: Parameters<typeof createMcpServer>[0], run: (client: Client) => Promise<void>) {
  const server = createMcpServer(config)
  const client = new Client({ name: 'dynamic-test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ])

  try {
    await run(client)
  }
  finally {
    await Promise.all([
      client.close(),
      server.close(),
    ])
  }
}

describe('Dynamic definition filtering (unit)', () => {
  it('registers tools without an enabled guard', async () => {
    await withClient({
      name: 'test',
      version: '1.0.0',
      tools: [{
        name: 'always_on',
        description: 'No guard',
        inputSchema: { msg: z.string() },
        handler: async ({ msg }) => ({ content: [{ type: 'text', text: msg }] }),
      }],
      resources: [],
      prompts: [],
    }, async (client) => {
      const { tools } = await client.listTools()
      expect(tools.map(t => t.name)).toContain('always_on')
    })
  })

  it('excludes tools that have already been filtered out before createMcpServer', async () => {
    const allTools = [
      {
        name: 'keep_me',
        description: 'This stays',
        handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      },
      {
        name: 'remove_me',
        description: 'This goes',
        handler: async () => ({ content: [{ type: 'text', text: 'no' }] }),
      },
    ]

    const filtered = allTools.filter(t => t.name !== 'remove_me')

    await withClient({
      name: 'test',
      version: '1.0.0',
      tools: filtered,
      resources: [],
      prompts: [],
    }, async (client) => {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).toContain('keep_me')
      expect(names).not.toContain('remove_me')
    })
  })

  it('supports empty tool list after filtering', async () => {
    await withClient({
      name: 'test',
      version: '1.0.0',
      tools: [],
      resources: [],
      prompts: [],
    }, async (client) => {
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(0)
    })
  })
})
