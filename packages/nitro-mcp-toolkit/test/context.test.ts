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
  it('hands the handler the event, signal and raw SDK context', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }))

    await client.callTool({ name: 'inspect' })

    const ctx = seen.at(-1)
    expect(ctx?.event.req.url).toBe('http://localhost/mcp')
    expect(ctx?.signal).toBeInstanceOf(AbortSignal)
    expect(ctx?.mcp.mcpReq).toBeDefined()
  })

  it('carries the auth info the caller passed to fetch', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }), {
      auth: { token: 'tok', clientId: 'client-1', scopes: ['mcp'], expiresAt: 4e9 },
    })

    await client.callTool({ name: 'inspect' })

    expect(seen.at(-1)?.auth).toMatchObject({ clientId: 'client-1', scopes: ['mcp'] })
  })

  it('leaves auth undefined when the caller passed none', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }))

    await client.callTool({ name: 'inspect' })

    expect(seen.at(-1)?.auth).toBeUndefined()
  })

  it('shares the event across concurrent requests without mixing them up', async () => {
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
      createMcpTestClient({
        fetch: (request, options) => {
          const tagged = new Request(request, {
            headers: { ...Object.fromEntries(request.headers), 'x-marker': marker },
          })
          return handler.fetch(tagged, options)
        },
      }).then(async (client) => {
        await client.callTool({ name: 'slow' })
      })

    await Promise.all([call('a'), call('b')])

    expect([...events].sort()).toEqual(['a', 'b'])
  })
})
