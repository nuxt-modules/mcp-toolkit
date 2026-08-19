import { describe, expect, it, vi } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
  imageResult,
} from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'

const handler = createMcpHandler({
  name: 'testing-helpers',
  tools: [
    defineMcpTool({ name: 'greet', handler: () => 'Hello Ada' }),
    defineMcpTool({ name: 'pixel', handler: () => imageResult('AAA=', 'image/png') }),
  ],
  resources: [defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'Readme' })],
  prompts: [
    defineMcpPrompt({
      name: 'review',
      handler: () => ({
        messages: [
          { role: 'assistant' as const, content: { type: 'text' as const, text: 'Sure.' } },
          { role: 'user' as const, content: { type: 'text' as const, text: 'Review this.' } },
        ],
      }),
    }),
  ],
})

describe('textOf', () => {
  it('reads the text out of a tool call, a resource read and a prompt alike', async () => {
    await using client = await createMcpTestClient(handler)

    expect(textOf(await client.callTool({ name: 'greet' }))).toBe('Hello Ada')
    expect(textOf(await client.readResource({ uri: 'docs://readme' }))).toBe('Readme')
    expect(textOf(await client.getPrompt({ name: 'review' }))).toBe('Sure.\nReview this.')
  })

  it('skips blocks that carry no text', async () => {
    await using client = await createMcpTestClient(handler)

    expect(textOf(await client.callTool({ name: 'pixel' }))).toBe('')
  })
})

describe('createMcpTestClient', () => {
  it('closes the client when it leaves scope', async () => {
    const close = vi.fn<() => Promise<void>>()

    {
      await using client = await createMcpTestClient(handler)
      client.close = close
    }

    expect(close).toHaveBeenCalledOnce()
  })

  it('sends extra headers on every request', async () => {
    const seen: string[] = []
    const guarded = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'who',
          handler: (event) => {
            seen.push(event.req.headers.get('x-tenant') ?? '')
            return 'ok'
          },
        }),
      ],
    })

    await using client = await createMcpTestClient(guarded, { headers: { 'x-tenant': 'acme' } })
    await client.callTool({ name: 'who' })

    expect(seen).toEqual(['acme'])
  })
})
