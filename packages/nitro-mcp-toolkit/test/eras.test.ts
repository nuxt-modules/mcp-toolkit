import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

// One definition set must serve both protocol revisions, so the two eras can
// never drift apart.
describe('protocol eras', () => {
  const eras = ['modern', 'legacy'] as const

  it.for(eras)('serves a %s client from the same handler', async (era) => {
    const seenEras: string[] = []
    const handler = createMcpHandler({
      name: 'both',
      tools: [
        defineMcpTool({
          name: 'greet',
          inputSchema: z.object({ name: z.string() }),
          handler: ({ name }, event) => {
            seenEras.push(event.context.mcp.era)
            return `Hello ${name}`
          },
        }),
      ],
    })

    await using client = await createMcpTestClient(handler, { era })

    const { tools } = await client.listTools()
    expect(tools).toMatchObject([{ name: 'greet' }])

    const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })
    expect(result.content).toEqual([{ type: 'text', text: 'Hello Ada' }])
    expect(seenEras).toEqual([era])
  })

  it('refuses a legacy client when the endpoint is modern-only', async () => {
    const handler = createMcpHandler({
      legacy: 'reject',
      tools: [defineMcpTool({ name: 'ping', handler: () => 'pong' })],
    })

    await expect(createMcpTestClient(handler, { era: 'legacy' })).rejects.toThrow(
      /Unsupported protocol version/,
    )
  })
})
