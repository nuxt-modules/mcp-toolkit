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

describe('what the server advertises', () => {
  it('carries its identity, icons and site to the client', async () => {
    const handler = createMcpHandler({
      ...identity,
      tools: [defineMcpTool({ name: 'greet', handler: () => 'Hello' })],
    })

    await using modern = await createMcpTestClient(handler)
    expect(modern.getServerVersion()).toMatchObject({
      name: identity.name,
      version: identity.version,
      title: identity.title,
    })

    // Icons, description and website live on `initialize`; a modern client
    // never sends that method.
    await using legacy = await createMcpTestClient(handler, { era: 'legacy' })
    expect(legacy.getServerVersion()).toMatchObject(identity)
  })
})
