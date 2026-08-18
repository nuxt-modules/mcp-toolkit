import { H3Event } from 'h3'
import { describe, expect, it } from 'vitest'
import { getElicitedContent, inputRequired, mcpElicit, mcpElicitUrl } from '../src/runtime/index.ts'
import type { McpRequestContext } from 'h3-mcp'

function event(mcp: McpRequestContext = {}): H3Event {
  const next = new H3Event(new Request('http://localhost/mcp'))
  next.context.mcp = mcp
  return next
}

const confirm = mcpElicit({
  message: 'Delete this?',
  requestedSchema: {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
    required: ['confirm'],
  },
})

describe('mcpElicit', () => {
  it('builds a form elicitation request', () => {
    expect(confirm).toEqual({
      method: 'elicitation/create',
      params: {
        message: 'Delete this?',
        requestedSchema: {
          type: 'object',
          properties: { confirm: { type: 'boolean' } },
          required: ['confirm'],
        },
      },
    })
  })

  it('builds a URL elicitation request', () => {
    expect(mcpElicitUrl({ message: 'Sign in', url: 'https://example.com/login' })).toEqual({
      method: 'elicitation/create',
      params: { message: 'Sign in', url: 'https://example.com/login', mode: 'url' },
    })
  })
})

describe('inputRequired', () => {
  it('returns the interim result on a modern request', () => {
    expect(inputRequired(event({ era: 'modern' }), { inputRequests: { confirm } })).toEqual({
      resultType: 'input_required',
      inputRequests: { confirm },
    })
  })

  it('accepts requestState without inputRequests', () => {
    expect(inputRequired(event(), { requestState: 'opaque' })).toEqual({
      resultType: 'input_required',
      requestState: 'opaque',
    })
  })

  it('refuses a legacy request', () => {
    expect(() => inputRequired(event({ era: 'legacy' }), { inputRequests: { confirm } })).toThrow(
      /input_required requires protocol 2026-07-28/,
    )
  })

  it('refuses a spec with neither field', () => {
    expect(() => inputRequired(event(), {})).toThrow(
      /input_required needs inputRequests or requestState/,
    )
  })
})

describe('getElicitedContent', () => {
  const requests = { confirm }

  it('reads an accepted form', () => {
    const ev = event({
      inputResponses: { confirm: { action: 'accept', content: { confirm: true } } },
    })

    expect(getElicitedContent<{ confirm: boolean }>(ev, requests, 'confirm')).toEqual({
      confirm: true,
    })
    expect(getElicitedContent<{ confirm: boolean }>(ev, 'confirm')).toEqual({ confirm: true })
  })

  it('returns undefined when the answer is missing, declined, or not an object', () => {
    expect(getElicitedContent(event(), requests, 'confirm')).toBeUndefined()
    expect(
      getElicitedContent(event({ inputResponses: { confirm: { action: 'decline' } } }), 'confirm'),
    ).toBeUndefined()
    expect(
      getElicitedContent(event({ inputResponses: { confirm: 'nope' } }), 'confirm'),
    ).toBeUndefined()
  })

  it('throws when the key is missing from the request map', () => {
    expect(() => getElicitedContent(event(), requests, 'other')).toThrow(
      /is not in the request map/,
    )
  })
})
