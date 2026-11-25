import { z } from 'zod'
import { HTTPError } from 'h3'
import { describe, expect, it } from 'vitest'
import {
  audioResult,
  createMcpHandler,
  defineMcpTool,
  imageResult,
  toolResult,
} from '../src/runtime/index.ts'
import { toCallToolResult } from '../src/runtime/results.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpToolReturn } from '../src/runtime/index.ts'

async function callReturning(value: McpToolReturn<undefined>) {
  const handler = createMcpHandler({
    tools: [defineMcpTool({ name: 'value', handler: () => value })],
  })
  await using client = await createMcpTestClient(handler)
  const result = await client.callTool({ name: 'value' })
  return result
}

describe('result coercion', () => {
  it('answers with no content for null', async () => {
    await expect(callReturning(null)).resolves.toMatchObject({ content: [] })
  })

  it('stringifies a non-object primitive the handler type does not name', () => {
    expect(toCallToolResult(1n, false)).toEqual({
      content: [{ type: 'text', text: '1' }],
    })
  })

  it('keeps image and audio content blocks as built', async () => {
    await expect(callReturning(imageResult('AAA=', 'image/png'))).resolves.toMatchObject({
      content: [{ type: 'image', data: 'AAA=', mimeType: 'image/png' }],
    })
    await expect(callReturning(audioResult('BBB=', 'audio/mp3'))).resolves.toMatchObject({
      content: [{ type: 'audio', data: 'BBB=', mimeType: 'audio/mp3' }],
    })
  })

  it('derives text from structuredContent when a result carries none', async () => {
    await expect(callReturning({ structuredContent: { ok: true } })).resolves.toMatchObject({
      content: [{ type: 'text', text: '{"ok":true}' }],
      structuredContent: { ok: true },
    })
  })

  it('explains an error result that carries no content', async () => {
    await expect(callReturning({ isError: true })).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'Tool execution failed' }],
    })
  })

  it('reports an HTTP error with its status and data', async () => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'boom',
          handler: () => {
            throw new HTTPError({ status: 404, message: 'Not found', data: { id: 'x' } })
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    const result = await client.callTool({ name: 'boom' })
    expect(result.isError).toBe(true)
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('[404] Not found') },
    ])
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('"id": "x"') },
    ])
  })

  it('reports a thrown non-error value', async () => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'boom',
          handler: () => {
            throw 'plain string'
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)

    await expect(client.callTool({ name: 'boom' })).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'plain string' }],
    })
  })

  it('preserves details of H3 v1 errors, such as Nuxt createError', async () => {
    class H3Error extends Error {
      static __h3_error__ = true
      statusCode = 404
      data = { id: 'demo' }
    }
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'missing',
          handler: () => {
            throw new H3Error('Not found')
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)
    expect(await client.callTool({ name: 'missing' })).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: '[404] Not found\n{\n  "id": "demo"\n}' }],
    })
  })

  it('keeps upstream response bodies of other errors from the client', async () => {
    // The shape of ofetch's FetchError when an upstream API refuses a `$fetch` call.
    class FetchError extends Error {
      status = 401
      statusCode = 401
      data = { internal_user_id: 42 }
    }
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'upstream',
          handler: () => {
            throw new FetchError('[GET] "https://api.example.com": 401 Unauthorized')
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)
    expect(await client.callTool({ name: 'upstream' })).toMatchObject({
      isError: true,
      content: [{ type: 'text', text: '[GET] "https://api.example.com": 401 Unauthorized' }],
    })
  })
})

it.each(['modern', 'legacy'] as const)(
  'preserves an explicit protocol result with an output schema on %s',
  async (era) => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'value',
          outputSchema: z.object({ n: z.number() }),
          handler: () =>
            toolResult({ content: [{ type: 'text', text: 'One' }], structuredContent: { n: 1 } }),
        }),
      ],
    })
    await using client = await createMcpTestClient(handler, { era })
    expect(await client.callTool({ name: 'value' })).toMatchObject({
      content: [{ type: 'text', text: 'One' }],
      structuredContent: { n: 1 },
    })
  },
)

it.each(['modern', 'legacy'] as const)(
  'validates explicit structured content on %s',
  async (era) => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'invalid',
          outputSchema: z.object({ n: z.number() }),
          handler: () => toolResult({ content: [], structuredContent: { n: 'invalid' } }),
        }),
      ],
    })
    await using client = await createMcpTestClient(handler, { era })
    await expect(client.callTool({ name: 'invalid' })).rejects.toThrow(
      /does not match its outputSchema/,
    )
  },
)

it.each(['modern', 'legacy'] as const)('preserves explicit error results on %s', async (era) => {
  const handler = createMcpHandler({
    tools: [
      defineMcpTool({
        name: 'denied',
        outputSchema: z.object({ n: z.number() }),
        handler: () =>
          toolResult({ content: [{ type: 'text', text: 'Unavailable' }], isError: true }),
      }),
    ],
  })
  await using client = await createMcpTestClient(handler, { era })
  expect(await client.callTool({ name: 'denied' })).toMatchObject({
    isError: true,
    content: [{ type: 'text', text: 'Unavailable' }],
  })
})
