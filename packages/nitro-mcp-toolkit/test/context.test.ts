import { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { attachNotify } from '../src/runtime/context.ts'
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
  it('hands the handler the event, signal, notifier and engine context', async () => {
    const { seen, tool } = inspector()
    const handler = createMcpHandler({ tools: [tool] })
    await using client = await createMcpTestClient(handler)

    await client.callTool({ name: 'inspect' })

    const event = seen.at(-1)
    expect(event?.req.url).toBe('http://localhost/mcp')
    expect(event?.context.mcp.signal).toBeInstanceOf(AbortSignal)
    expect(event?.context.mcp.era).toBe('modern')
    expect(event?.context.mcp.notify).toBe(handler.notify)
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
        fetch: (request) => {
          const tagged = new Request(request, {
            headers: { ...Object.fromEntries(request.headers), 'x-marker': marker },
          })
          return handler.fetch(tagged)
        },
      }).then(async (client) => {
        await client.callTool({ name: 'slow' })
      })

    await Promise.all([call('a'), call('b')])

    expect([...events].sort()).toEqual(['a', 'b'])
  })

  it('refuses to attach notify when no MCP request is in scope', () => {
    expect(() =>
      attachNotify(new H3Event(new Request('http://localhost/mcp')), {
        toolsChanged: () => {},
        promptsChanged: () => {},
        resourcesChanged: () => {},
        resourceUpdated: () => {},
      }),
    ).toThrow(/No MCP request in scope/)
  })
})
