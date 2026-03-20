import { PassThrough } from 'node:stream'
import { describe, it, expect } from 'vitest'
import { createEvent } from 'h3'
import { extractToolNames } from '../src/runtime/server/mcp/definitions/extract-tool-names'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockReq(method: string, headers: Record<string, string>): any {
  const req = new PassThrough()
  Object.assign(req, {
    method,
    url: '/mcp',
    headers,
    httpVersion: '1.1',
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    connection: {},
    socket: {},
  })
  return req
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRes(): any {
  return {
    statusCode: 200,
    setHeader() {},
    end() {},
    getHeader() { return undefined },
  }
}

function createMockEvent(body: unknown) {
  const json = JSON.stringify(body)
  const req = createMockReq('POST', {
    'content-type': 'application/json',
    'content-length': String(Buffer.byteLength(json)),
  })
  const event = createEvent(req, createMockRes())
  req.end(json)
  return event
}

function createEmptyEvent() {
  const req = createMockReq('GET', {})
  const event = createEvent(req, createMockRes())
  req.end()
  return event
}

describe('extractToolNames', () => {
  it('should extract a single tool name from tools/call', async () => {
    const event = createMockEvent({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'my-tool', arguments: {} },
      id: 1,
    })

    const names = await extractToolNames(event)
    expect(names).toEqual(['my-tool'])
  })

  it('should extract multiple tool names from a batch request', async () => {
    const event = createMockEvent([
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'tool-a', arguments: {} },
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'tool-b', arguments: { x: 1 } },
        id: 2,
      },
    ])

    const names = await extractToolNames(event)
    expect(names).toEqual(['tool-a', 'tool-b'])
  })

  it('should return empty array for non tools/call methods', async () => {
    const event = createMockEvent({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
    })

    const names = await extractToolNames(event)
    expect(names).toEqual([])
  })

  it('should return empty array for empty body', async () => {
    const event = createEmptyEvent()

    const names = await extractToolNames(event)
    expect(names).toEqual([])
  })

  it('should skip messages without params.name', async () => {
    const event = createMockEvent({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {},
      id: 1,
    })

    const names = await extractToolNames(event)
    expect(names).toEqual([])
  })

  it('should handle mixed batch with tools/call and other methods', async () => {
    const event = createMockEvent([
      {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      },
      {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'only-this-one', arguments: {} },
        id: 2,
      },
      {
        jsonrpc: '2.0',
        method: 'resources/read',
        params: { uri: 'file:///test' },
        id: 3,
      },
    ])

    const names = await extractToolNames(event)
    expect(names).toEqual(['only-this-one'])
  })

  it('should skip non-string name values', async () => {
    const event = createMockEvent({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 123 },
      id: 1,
    })

    const names = await extractToolNames(event)
    expect(names).toEqual([])
  })
})
