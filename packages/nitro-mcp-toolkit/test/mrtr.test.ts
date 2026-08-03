import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  acceptedContent,
  createMcpHandler,
  defineMcpTool,
  inputRequired,
  inputResponse,
} from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'

// The tool asks before it acts, and reads the answer on the retry the client
// sends by itself.
function serve() {
  return createMcpHandler({
    name: 'mrtr',
    version: '1.0.0',
    tools: [
      defineMcpTool({
        name: 'wipe',
        inputSchema: z.object({ scope: z.string() }),
        handler: ({ scope }, ctx) => {
          if (inputResponse(ctx.mcp.inputResponses, 'confirm').kind === 'missing') {
            return inputRequired({
              requests: {
                confirm: {
                  method: 'elicitation/create',
                  params: {
                    message: `Delete ${scope}?`,
                    requestedSchema: {
                      type: 'object',
                      properties: { sure: { type: 'boolean' } },
                      required: ['sure'],
                    },
                  },
                },
              },
              state: `scope:${scope}`,
            })
          }

          const content = acceptedContent(ctx.mcp.inputResponses, 'confirm')

          return content ? `wiped ${ctx.mcp.requestState} (sure=${content.sure})` : `kept ${scope}`
        },
      }),
    ],
  })
}

describe('a tool that needs an answer mid-call', () => {
  it('gets one, and sees its own state come back', async () => {
    await using client = await createMcpTestClient(serve(), {
      capabilities: { elicitation: {} },
    })
    client.setRequestHandler('elicitation/create', () => ({
      action: 'accept',
      content: { sure: true },
    }))

    const result = await client.callTool({ name: 'wipe', arguments: { scope: 'everything' } })

    expect(textOf(result)).toBe('wiped scope:everything (sure=true)')
  })

  it('carries on when the client says no', async () => {
    await using client = await createMcpTestClient(serve(), {
      capabilities: { elicitation: {} },
    })
    client.setRequestHandler('elicitation/create', () => ({ action: 'decline' }))

    const result = await client.callTool({ name: 'wipe', arguments: { scope: 'the logs' } })

    expect(textOf(result)).toBe('kept the logs')
  })
})

describe('reading an answer', () => {
  it('tells the three kinds apart', () => {
    expect(inputResponse({ a: { action: 'accept', content: { ok: true } } }, 'a')).toEqual({
      kind: 'elicit',
      action: 'accept',
      content: { ok: true },
    })
    expect(
      inputResponse({ a: { roots: [{ uri: 'file:///w', name: 'w' }, 'nonsense'] } }, 'a'),
    ).toEqual({ kind: 'roots', roots: [{ uri: 'file:///w', name: 'w' }] })
    expect(
      inputResponse({ a: { role: 'assistant', content: { type: 'text', text: 'hi' } } }, 'a'),
    ).toEqual({ kind: 'sampling', role: 'assistant', content: { type: 'text', text: 'hi' } })
  })

  it('reports anything it cannot read as missing', () => {
    expect(inputResponse(undefined, 'a')).toEqual({ kind: 'missing' })
    expect(inputResponse({}, 'a')).toEqual({ kind: 'missing' })
    expect(inputResponse({ a: 'not an object' }, 'a')).toEqual({ kind: 'missing' })
    expect(inputResponse({ a: { unknown: true } }, 'a')).toEqual({ kind: 'missing' })
  })

  it('treats an unusable elicitation as no content', () => {
    expect(acceptedContent({ a: { action: 'cancel' } }, 'a')).toBeUndefined()
    expect(acceptedContent({ a: { action: 'accept' } }, 'a')).toBeUndefined()
    // An action the spec does not define is not an acceptance.
    expect(inputResponse({ a: { action: 'shrug' } }, 'a')).toEqual({
      kind: 'elicit',
      action: 'cancel',
    })
  })
})

describe('asking for nothing', () => {
  it('is refused, since the client would wait forever', () => {
    expect(() => inputRequired({})).toThrow(/needs `requests`, `state`, or both/)
  })
})
