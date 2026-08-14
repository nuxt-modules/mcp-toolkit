import { describe, it, expect } from 'vitest'
import { parseMcpToolsHeader, filterToolsByRequestedNames } from '../src/runtime/server/mcp/filter-tools-header'

describe('parseMcpToolsHeader', () => {
  it('returns undefined when the header is absent', () => {
    expect(parseMcpToolsHeader(undefined)).toBeUndefined()
  })

  it('returns an empty set for an empty or whitespace-only value', () => {
    expect(parseMcpToolsHeader('')).toEqual(new Set())
    expect(parseMcpToolsHeader('  ')).toEqual(new Set())
    expect(parseMcpToolsHeader(' , , ')).toEqual(new Set())
  })

  it('trims, splits, and deduplicates names', () => {
    expect(parseMcpToolsHeader('search-icons, get-component, search-icons')).toEqual(
      new Set(['search-icons', 'get-component']),
    )
  })
})

describe('filterToolsByRequestedNames', () => {
  const tools = [
    { name: 'search-icons', description: 'a' },
    { name: 'get-component', description: 'b' },
    { name: 'get-migration-guide', description: 'c' },
  ]

  it('returns only the requested tools, preserving original order', () => {
    const result = filterToolsByRequestedNames(tools, new Set(['get-migration-guide', 'search-icons']))
    expect(result.unknownNames).toEqual([])
    expect(result.tools.map(tool => tool.name)).toEqual(['search-icons', 'get-migration-guide'])
  })

  it('returns an empty list when the allowlist is empty', () => {
    const result = filterToolsByRequestedNames(tools, new Set())
    expect(result.unknownNames).toEqual([])
    expect(result.tools).toEqual([])
  })

  it('reports unknown names without throwing', () => {
    const result = filterToolsByRequestedNames(tools, new Set(['search-icons', 'nope', 'also-missing']))
    expect(result.unknownNames).toEqual(['nope', 'also-missing'])
  })

  it('matches filename-generated kebab-case names', () => {
    const unnamed = [
      { _meta: { filename: 'search-icons.ts' } },
      { _meta: { filename: 'getComponent.ts' } },
    ]
    const result = filterToolsByRequestedNames(unnamed, new Set(['search-icons', 'get-component']))
    expect(result.unknownNames).toEqual([])
    expect(result.tools).toEqual(unnamed)
  })

  it('prefers an explicit name over the filename', () => {
    const named = [{ name: 'custom-name', _meta: { filename: 'search-icons.ts' } }]
    const miss = filterToolsByRequestedNames(named, new Set(['search-icons']))
    expect(miss.unknownNames).toEqual(['search-icons'])
    const hit = filterToolsByRequestedNames(named, new Set(['custom-name']))
    expect(hit.unknownNames).toEqual([])
    expect(hit.tools).toEqual(named)
  })
})
