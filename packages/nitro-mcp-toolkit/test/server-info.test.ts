import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('what the server advertises', () => {
  it('carries its identity, icons and site to the client', async () => {
    const handler = createMcpHandler({
      name: 'catalogue',
      version: '2.1.0',
      title: 'Catalogue',
      description: 'Everything on the shelves',
      icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] }],
      websiteUrl: 'https://example.com',
      tools: [defineMcpTool({ name: 'greet', handler: () => 'Hello' })],
    })

    await using client = await createMcpTestClient(handler)

    expect(client.getServerVersion()).toMatchObject({
      name: 'catalogue',
      version: '2.1.0',
      title: 'Catalogue',
      description: 'Everything on the shelves',
      icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] }],
      websiteUrl: 'https://example.com',
    })
  })
})
