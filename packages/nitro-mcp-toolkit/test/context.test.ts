import { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { attachNotify } from '../src/runtime/context.ts'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'
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
  it.each(['modern', 'legacy'] as const)(
    'forwards adapter context by reference for %s requests',
    async (era) => {
      const context: Record<string, unknown> = { user: 'demo' }
      const endpoint = createMcpHandler({
        tools: [
          defineMcpTool({
            name: 'who',
            handler: (event) => {
              expect(event.context).toBe(context)
              event.context.visited = true
              return String(event.context.user)
            },
          }),
        ],
      })
      await using client = await createMcpTestClient(
        { fetch: (request) => endpoint.fetch(request, context) },
        { era },
      )
      expect(textOf(await client.callTool({ name: 'who' }))).toBe('demo')
      expect(context.visited).toBe(true)
    },
  )

  it('keeps engine progress callable when a definition receives its notifier', async () => {
    const handler = createMcpHandler({
      tools: [
        defineMcpTool({
          name: 'progress',
          handler: (event) => {
            event.context.mcp.progress?.(1, 1, 'done')
            return 'progress delivered'
          },
        }),
      ],
    })
    await using client = await createMcpTestClient(handler)
    const result = await client.callTool({
      name: 'progress',
      _meta: { progressToken: 'regression' },
    })
    expect(result.isError).not.toBe(true)
    expect(textOf(result)).toBe('progress delivered')
  })

  it('hands the handler the event, signal, notifier and engine context', async () => {
    const { seen, tool } = inspector()
    const handler = createMcpHandler({ tools: [tool] })
    await using client = await createMcpTestClient(handler)

    await client.callTool({ name: 'inspect' })

    const event = seen.at(-1)
    expect(event?.req.url).toBe('http://localhost/mcp')
    expect(event?.context.mcp.signal).toBeInstanceOf(AbortSignal)
    expect(event?.context.mcp.era).toBe('modern')
    expect(event?.context.mcp.notify).toBeTypeOf('function')
    expect(event?.context.mcp.notifier).toBe(handler.notify)
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
