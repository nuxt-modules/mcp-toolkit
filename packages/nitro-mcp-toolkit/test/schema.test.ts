import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { completable, createMcpHandler, defineMcpPrompt } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

// Completions rely on the SDK walking the schema object to find `completable()`
// fields, which is why a definition must hand it the schema untouched. Wrapping
// or spreading one drops prototype getters such as Zod's `shape`, and this test
// is what catches that.
describe('schemas reach the SDK intact', () => {
  it('serves completions declared with completable()', async () => {
    const handler = createMcpHandler({
      name: 'completions',
      prompts: [
        defineMcpPrompt({
          name: 'pick',
          inputSchema: z.object({
            fruit: completable(z.string(), (value) =>
              ['apple', 'apricot', 'banana'].filter((fruit) => fruit.startsWith(value)),
            ),
          }),
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
