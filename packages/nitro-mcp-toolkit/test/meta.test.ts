import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('definition metadata', () => {
  it.each(['modern', 'legacy'] as const)(
    'preserves extension metadata for %s clients',
    async (era) => {
      const meta = { 'example.com/extension': { enabled: true } }
      const endpoint = createMcpHandler({
        tools: [defineMcpTool({ name: 'tool', _meta: meta, handler: () => 'ok' })],
        resources: [
          defineMcpResource({
            name: 'resource',
            uri: 'docs://meta',
            _meta: meta,
            handler: () => 'ok',
          }),
          defineMcpResource({
            name: 'template',
            uriTemplate: 'docs://{slug}',
            _meta: meta,
            handler: () => 'ok',
          }),
        ],
        prompts: [defineMcpPrompt({ name: 'prompt', _meta: meta, handler: () => 'ok' })],
      })
      await using client = await createMcpTestClient(endpoint, { era })
      expect((await client.listTools()).tools[0]?._meta).toEqual(meta)
      expect((await client.listResources()).resources[0]?._meta).toEqual(meta)
      expect((await client.listResourceTemplates()).resourceTemplates[0]?._meta).toEqual(meta)
      expect((await client.listPrompts()).prompts[0]?._meta).toEqual(meta)
    },
  )

  it('keeps declared fields ahead of conflicting extension metadata', async () => {
    const definition = {
      group: 'admin',
      tags: ['destructive'],
      scopes: ['write'],
      _meta: { group: 'other', tags: ['other'], scopes: ['other'], extension: true },
      handler: () => 'ok',
    }
    const endpoint = createMcpHandler({
      tools: [defineMcpTool({ ...definition, name: 'tool' })],
      resources: [defineMcpResource({ ...definition, name: 'resource', uri: 'docs://meta' })],
      prompts: [defineMcpPrompt({ ...definition, name: 'prompt' })],
    })
    await using client = await createMcpTestClient(endpoint)
    const expected = { group: 'admin', tags: ['destructive'], scopes: ['write'], extension: true }
    expect((await client.listTools()).tools[0]?._meta).toEqual(expected)
    expect((await client.listResources()).resources[0]?._meta).toEqual(expected)
    expect((await client.listPrompts()).prompts[0]?._meta).toEqual(expected)
    expect(definition._meta).toEqual({
      group: 'other',
      tags: ['other'],
      scopes: ['other'],
      extension: true,
    })
  })
})
