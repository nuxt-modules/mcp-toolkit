import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createMcpHandler, defineMcpPrompt } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

describe('prompt arguments reach the engine', () => {
  it('serves completions declared on an argument', async () => {
    const handler = createMcpHandler({
      name: 'completions',
      prompts: [
        defineMcpPrompt({
          name: 'pick',
          arguments: [
            {
              name: 'fruit',
              complete: (ctx) => ({
                values: ['apple', 'apricot', 'banana'].filter((fruit) =>
                  fruit.startsWith(ctx.argument.value),
                ),
              }),
            },
          ],
          handler: ({ fruit }) => `You picked ${fruit}`,
        }),
      ],
    })

    await using client = await createMcpTestClient(handler)

    const completion = await client.complete({
      ref: { type: 'ref/prompt', name: 'pick' },
      argument: { name: 'fruit', value: 'ap' },
    })

    expect(completion.completion.values).toEqual(['apple', 'apricot'])
  })

  it('advertises a stable schema, call after call', async () => {
    const handler = createMcpHandler({
      name: 'stable',
      prompts: [
        defineMcpPrompt({
          name: 'greet',
          inputSchema: z.object({ name: z.string() }),
          handler: ({ name }) => name,
        }),
      ],
    })

    await using client = await createMcpTestClient(handler)

    const first = (await client.listPrompts()).prompts[0]
    for (let i = 0; i < 5; i++) {
      await client.listPrompts()
    }

    expect((await client.listPrompts()).prompts[0]).toEqual(first)
  })
})
