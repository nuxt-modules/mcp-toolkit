import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpPrompt, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

const trimmedString = v.pipe(v.string(), v.trim(), v.minLength(1))

describe('Valibot schemas', () => {
  it('advertises and validates tool input and output schemas', async () => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'greet',
          inputSchema: v.object({ name: trimmedString }),
          outputSchema: v.object({ greeting: trimmedString }),
          handler: ({ name }) => ({ greeting: `Hello ${name}` }),
        }),
        defineMcpTool({
          name: 'invalid-output',
          outputSchema: v.object({ greeting: trimmedString }),
          handler: () => ({ greeting: ' ' }),
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { tools } = await client.listTools()
    expect(tools[0]?.inputSchema).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string', minLength: 1 } },
      required: ['name'],
    })
    expect(tools[0]?.outputSchema).toMatchObject({
      type: 'object',
      properties: { greeting: { type: 'string', minLength: 1 } },
      required: ['greeting'],
    })
    expect(tools[0]?.inputSchema).not.toHaveProperty('~standard')
    expect(tools[0]?.outputSchema).not.toHaveProperty('~standard')

    const result = await client.callTool({ name: 'greet', arguments: { name: ' Ada ' } })
    expect(result.structuredContent).toEqual({ greeting: 'Hello Ada' })

    const invalidInput = await client.callTool({ name: 'greet', arguments: { name: ' ' } })
    expect(invalidInput.isError).toBe(true)
    expect(invalidInput.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('Invalid input') },
    ])

    await expect(client.callTool({ name: 'invalid-output' })).rejects.toThrow(
      /does not match its outputSchema/,
    )
  })

  it('advertises and validates prompt arguments', async () => {
    const handler = createMcpHandler({
      prompts: [
        defineMcpPrompt({
          name: 'review',
          inputSchema: v.object({
            path: v.pipe(trimmedString, v.description('File to review')),
          }),
          handler: ({ path }) => `Review ${path}.`,
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const { prompts } = await client.listPrompts()
    expect(prompts[0]?.arguments).toEqual([
      { name: 'path', description: 'File to review', required: true },
    ])

    const result = await client.getPrompt({ name: 'review', arguments: { path: ' src/index.ts ' } })
    expect(result.messages).toEqual([
      { role: 'user', content: { type: 'text', text: 'Review src/index.ts.' } },
    ])

    await expect(client.getPrompt({ name: 'review', arguments: { path: ' ' } })).rejects.toThrow(
      /Invalid prompt arguments/,
    )
  })
})
