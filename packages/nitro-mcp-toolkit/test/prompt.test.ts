import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createMcpHandler, defineMcpPrompt } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('defineMcpPrompt', () => {
  it('expands an argument-less prompt from a returned string', async () => {
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'standup',
          title: 'Daily standup',
          handler: () => 'Summarize yesterday.',
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { prompts } = await client.listPrompts()
    expect(prompts).toMatchObject([{ name: 'standup', title: 'Daily standup' }])

    const result = await client.getPrompt({ name: 'standup' })
    expect(result.messages).toEqual([
      { role: 'user', content: { type: 'text', text: 'Summarize yesterday.' } },
    ])
  })

  it('advertises arguments and receives them parsed', async () => {
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'review',
          inputSchema: z.object({ path: z.string().describe('File to review') }),
          handler: ({ path }) => `Review ${path}.`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { prompts } = await client.listPrompts()
    expect(prompts[0]?.arguments).toMatchObject([{ name: 'path', description: 'File to review' }])

    const result = await client.getPrompt({ name: 'review', arguments: { path: 'src/index.ts' } })
    expect(result.messages).toEqual([
      { role: 'user', content: { type: 'text', text: 'Review src/index.ts.' } },
    ])
  })

  it('passes a multi-message result through untouched', async () => {
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'pair',
          handler: () => ({
            messages: [
              { role: 'user' as const, content: { type: 'text' as const, text: 'ping' } },
              { role: 'assistant' as const, content: { type: 'text' as const, text: 'pong' } },
            ],
          }),
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const result = await client.getPrompt({ name: 'pair' })
    expect(result.messages).toHaveLength(2)
    expect(result.messages[1]).toMatchObject({ role: 'assistant' })
  })

  // Unlike a tool, `prompts/get` has no `isError` field: a thrown handler
  // error must surface as a JSON-RPC-level error rather than an in-band result.
  it('rejects cleanly when the handler throws, rather than an in-band result', async () => {
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'broken',
          handler: () => {
            throw new Error('it broke')
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    await expect(client.getPrompt({ name: 'broken' })).rejects.toThrow(/Internal error/)
  })
})
