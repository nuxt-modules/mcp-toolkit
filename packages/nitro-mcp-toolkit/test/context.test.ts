import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpEvent } from '../src/runtime/index.ts'

/**
 * Captures the event a handler was entered with, so the wiring around it can
 * be asserted without reaching into internals.
 */
function inspector() {
  const seen: McpEvent[] = []
  const tool = defineMcpTool({
    name: 'inspect',
    handler: (event) => {
      seen.push(event)
      return 'ok'
    },
  })
  return { seen, tool }
}

describe('handler event', () => {
  it('hands the handler the event, signal, notifier and raw SDK context', async () => {
    const { seen, tool } = inspector()
    const handler = createMcpHandler({ tools: [tool] })
    await using client = await createMcpTestClient(handler)

    await client.callTool({ name: 'inspect' })

    const event = seen.at(-1)
    expect(event?.req.url).toBe('http://localhost/mcp')
    expect(event?.context.mcp.signal).toBeInstanceOf(AbortSignal)
    expect(event?.context.mcp.mcpReq).toBeDefined()
    expect(event?.context.mcp.notify).toBe(handler.notify)
  })

  it('carries the auth info the caller passed to fetch', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }), {
      auth: { token: 'tok', clientId: 'client-1', scopes: ['mcp'], expiresAt: 4e9 },
    })

    await client.callTool({ name: 'inspect' })

    expect(seen.at(-1)?.context.mcp.auth).toMatchObject({ clientId: 'client-1', scopes: ['mcp'] })
  })

  it('leaves auth undefined when the caller passed none', async () => {
    const { seen, tool } = inspector()
    await using client = await createMcpTestClient(createMcpHandler({ tools: [tool] }))

    await client.callTool({ name: 'inspect' })

    expect(seen.at(-1)?.context.mcp.auth).toBeUndefined()
  })

  it('shares the event across concurrent requests without mixing them up', async () => {
    const events: string[] = []
    const tool = defineMcpTool({
      name: 'slow',
      handler: async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        events.push(event.req.headers.get('x-marker') ?? 'none')
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
