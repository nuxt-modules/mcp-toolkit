import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import {
  filterRegistrationsByToolAllowlist,
  parseMcpToolsHeader,
} from '../src/runtime/tools-header.ts'
import { createMcpTestClient } from '../src/testing/index.ts'

function handler() {
  return createMcpHandler({
    tools: [
      defineMcpTool({ name: 'search-icons', handler: () => 'icons' }),
      defineMcpTool({ name: 'get-component', handler: () => 'component' }),
      defineMcpTool({ name: 'get-migration-guide', handler: () => 'guide' }),
    ],
    resources: [
      defineMcpResource({ name: 'readme', uri: 'docs://readme', handler: () => 'Readme' }),
    ],
    prompts: [defineMcpPrompt({ name: 'review', handler: () => 'ok' })],
  })
}

function withToolsHeader(value: string | undefined) {
  const mcp = handler()
  return createMcpTestClient({
    fetch: (request, options) => {
      const headers = new Headers(request.headers)
      if (value !== undefined) headers.set('x-mcp-tools', value)
      return mcp.fetch(new Request(request, { headers }), options)
    },
  })
}

describe('parseMcpToolsHeader', () => {
  it('returns undefined when the header is absent', () => {
    expect(parseMcpToolsHeader(undefined)).toBeUndefined()
    expect(parseMcpToolsHeader(null)).toBeUndefined()
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

describe('filterRegistrationsByToolAllowlist', () => {
  const registrations = [
    { definition: { kind: 'tool' }, identity: { name: 'search-icons' } },
    { definition: { kind: 'tool' }, identity: { name: 'get-component' } },
    { definition: { kind: 'resource' }, identity: { name: 'readme' } },
  ]

  it('keeps requested tools and every non-tool', () => {
    const result = filterRegistrationsByToolAllowlist(registrations, new Set(['search-icons']))
    expect(result.unknownNames).toEqual([])
    expect(result.registrations.map((entry) => entry.identity.name)).toEqual([
      'search-icons',
      'readme',
    ])
  })

  it('reports unknown names', () => {
    const result = filterRegistrationsByToolAllowlist(registrations, new Set(['nope']))
    expect(result.unknownNames).toEqual(['nope'])
  })
})

describe('X-MCP-Tools', () => {
  it('leaves the catalog alone when the header is absent', async () => {
    await using client = await withToolsHeader(undefined)
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get-component',
      'get-migration-guide',
      'search-icons',
    ])
  })

  it('limits tools/list to the requested names', async () => {
    await using client = await withToolsHeader('search-icons, get-component')
    const { tools } = await client.listTools()
    expect(tools.map((tool) => tool.name).sort()).toEqual(['get-component', 'search-icons'])
  })

  it('still serves resources and prompts when tools are subset', async () => {
    await using client = await withToolsHeader('search-icons')
    const [{ resources }, { prompts }] = await Promise.all([
      client.listResources(),
      client.listPrompts(),
    ])
    expect(resources.map((resource) => resource.name)).toEqual(['readme'])
    expect(prompts.map((prompt) => prompt.name)).toEqual(['review'])
  })

  it('exposes no tools when the allowlist is empty', async () => {
    await using client = await withToolsHeader('  ')
    const { tools } = await client.listTools()
    expect(tools).toEqual([])
  })

  it('does not change handler.definitions', () => {
    expect(
      handler()
        .definitions.filter((definition) => definition.kind === 'tool')
        .map((definition) => definition.name),
    ).toEqual(['search-icons', 'get-component', 'get-migration-guide'])
  })

  it('returns HTTP 400 when a name is unknown', async () => {
    const response = await handler().fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-mcp-tools': 'does-not-exist',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('Unknown MCP tool: does-not-exist')
  })
})
