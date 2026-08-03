import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

const identity = {
  name: 'catalogue',
  version: '2.1.0',
  title: 'Catalogue',
  description: 'Everything on the shelves',
  icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] }],
  websiteUrl: 'https://example.com',
}

const handler = createMcpHandler({
  ...identity,
  tools: [defineMcpTool({ name: 'greet', handler: () => 'Hello' })],
})

describe('what the server advertises', () => {
  it('carries its whole identity to a 2025-era client', async () => {
    await using client = await createMcpTestClient(handler, { era: 'legacy' })

    expect(client.getServerVersion()).toMatchObject(identity)
  })

  // The engine keeps modern `_meta` to three fields, so a modern-only client
  // cannot see the icons yet.
  it('names itself to a modern client', async () => {
    await using client = await createMcpTestClient(handler)

    expect(client.getServerVersion()).toEqual({
      name: 'catalogue',
      version: '2.1.0',
      title: 'Catalogue',
    })
  })
})
