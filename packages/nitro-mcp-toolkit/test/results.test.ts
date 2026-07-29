import { HTTPError } from 'h3'
import { describe, expect, it } from 'vitest'
import { audioResult, createMcpHandler, defineMcpTool, imageResult } from '../src/runtime'
import { createMcpTestClient } from '../src/testing'
import type { McpToolReturn } from '../src/runtime'

async function callReturning(value: McpToolReturn<undefined>) {
  const handler = createMcpHandler({
    tools: [defineMcpTool({ name: 'value', handler: () => value })],
  })
  const client = await createMcpTestClient(handler)
  const result = await client.callTool({ name: 'value' })
  await client.close()
  return result
}

describe('result coercion', () => {
  it('answers with no content for null', async () => {
    await expect(callReturning(null)).resolves.toMatchObject({ content: [] })
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
    const client = await createMcpTestClient(handler)

    const result = await client.callTool({ name: 'boom' })
    expect(result.isError).toBe(true)
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('[404] Not found') },
    ])
    expect(result.content).toMatchObject([
      { type: 'text', text: expect.stringContaining('"id": "x"') },
    ])

    await client.close()
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
    const client = await createMcpTestClient(handler)

    await expect(client.callTool({ name: 'boom' })).resolves.toMatchObject({
      isError: true,
      content: [{ type: 'text', text: 'plain string' }],
    })

    await client.close()
  })
})
