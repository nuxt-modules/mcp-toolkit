import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpContext } from '../src/runtime/index.ts'

/**
 * Captures the context a handler was entered with, so the wiring around it can
 * be asserted without reaching into internals.
 */
function inspector() {
  const seen: McpContext[] = []
  const tool = defineMcpTool({
    name: 'inspect',
    handler: (ctx) => {
      seen.push(ctx)
      return 'ok'
    },
  })
  return { seen, tool }
}

describe('handler context', () => {
  it('hands the handler the event, the signal and the request', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }))

    await client.callTool({ name: 'inspect' })

    const ctx = seen.at(-1)
    expect(ctx?.event.req.url).toBe('http://localhost/mcp')
    expect(ctx?.signal).toBeInstanceOf(AbortSignal)
    expect(ctx?.era).toBe('modern')
    expect(ctx?.mcp.requestId).toBeDefined()
  })

  it('reaches the whole request, headers included', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }), {
      headers: { 'x-client': 'client-1' },
    })

    await client.callTool({ name: 'inspect' })

    expect(seen.at(-1)?.event.req.headers.get('x-client')).toBe('client-1')
  })

  it('keeps concurrent requests on their own event', async () => {
    const events: string[] = []
    const tool = defineMcpTool({
      name: 'slow',
      handler: async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        events.push(ctx.event.req.headers.get('x-marker') ?? 'none')
        return 'ok'
      },
    })
    const handler = createMcpHandler({ tools: [tool] })

    const call = (marker: string) =>
      createMcpTestClient(handler, { headers: { 'x-marker': marker } }).then(async (client) => {
        await client.callTool({ name: 'slow' })
        await client.close()
      })

    await Promise.all([call('a'), call('b')])

    expect([...events].sort()).toEqual(['a', 'b'])
  })
})
