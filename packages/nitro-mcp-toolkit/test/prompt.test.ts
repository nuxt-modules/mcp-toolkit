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
    const client = await createMcpTestClient(handler)

    const { prompts } = await client.listPrompts()
    expect(prompts).toMatchObject([{ name: 'standup', title: 'Daily standup' }])

    const result = await client.getPrompt({ name: 'standup' })
    expect(result.messages).toEqual([
      { role: 'user', content: { type: 'text', text: 'Summarize yesterday.' } },
    ])

    await client.close()
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
    const client = await createMcpTestClient(handler)

    const { prompts } = await client.listPrompts()
    expect(prompts[0]?.arguments).toMatchObject([{ name: 'path', description: 'File to review' }])

    const result = await client.getPrompt({ name: 'review', arguments: { path: 'src/index.ts' } })
    expect(result.messages).toEqual([
      { role: 'user', content: { type: 'text', text: 'Review src/index.ts.' } },
    ])

    await client.close()
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
    const client = await createMcpTestClient(handler)

    const result = await client.getPrompt({ name: 'pair' })
    expect(result.messages).toHaveLength(2)
    expect(result.messages[1]).toMatchObject({ role: 'assistant' })

    await client.close()
  })
})
