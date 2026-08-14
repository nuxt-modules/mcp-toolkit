import { describe, it, expect } from 'vitest'
import { parseToolCallNames } from '../src/runtime/server/mcp/definitions/extract-tool-names'

describe('parseToolCallNames', () => {
  it('should extract a single tool name from tools/call', () => {
    const names = parseToolCallNames({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'my-tool', arguments: {} },
      id: 1,
    })

    expect(names).toEqual(['my-tool'])
  })

  it('should extract multiple tool names from a batch request', () => {
    const names = parseToolCallNames([
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

    expect(names).toEqual(['tool-a', 'tool-b'])
  })

  it('should return empty array for non tools/call methods', () => {
    const names = parseToolCallNames({
      jsonrpc: '2.0',
      method: 'tools/list',
      id: 1,
    })

    expect(names).toEqual([])
  })

  it('should return empty array for empty body', () => {
    expect(parseToolCallNames(undefined)).toEqual([])
    expect(parseToolCallNames(null)).toEqual([])
  })

  it('should skip messages without params.name', () => {
    const names = parseToolCallNames({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {},
      id: 1,
    })

    expect(names).toEqual([])
  })

  it('should handle mixed batch with tools/call and other methods', () => {
    const names = parseToolCallNames([
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

    expect(names).toEqual(['only-this-one'])
  })

  it('should skip non-string name values', () => {
    const names = parseToolCallNames({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 123 },
      id: 1,
    })

    expect(names).toEqual([])
  })
})
