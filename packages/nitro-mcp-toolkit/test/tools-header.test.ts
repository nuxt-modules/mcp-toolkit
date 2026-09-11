import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import { parseMcpToolsHeader, unknownToolNames } from '../src/runtime/tools-header.ts'
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
  return createMcpTestClient(
    handler(),
    value === undefined ? {} : { headers: { 'x-mcp-tools': value } },
  )
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

describe('unknownToolNames', () => {
  const registrations = [
    { definition: { kind: 'tool' }, identity: { name: 'search-icons' } },
    { definition: { kind: 'tool' }, identity: { name: 'get-component' } },
    { definition: { kind: 'resource' }, identity: { name: 'readme' } },
  ]
  const toolNames = new Set(
    registrations
      .filter((entry) => entry.definition.kind === 'tool')
      .map((entry) => entry.identity.name),
  )

  it('reports names that are not a registered tool', () => {
    expect(unknownToolNames(toolNames, new Set(['search-icons']))).toEqual([])
    expect(unknownToolNames(toolNames, new Set(['nope']))).toEqual(['nope'])
  })

  it('does not treat a resource name as a tool', () => {
    expect(unknownToolNames(toolNames, new Set(['readme']))).toEqual(['readme'])
  })
})

describe('X-MCP-Tools', () => {
  for (const era of ['modern', 'legacy'] as const) {
    it(`reauthorizes repeated selections after credentials are revoked (${era})`, async () => {
      let allowed = true
      const endpoint = createMcpHandler({
        auth: { schemes: ['bearer'], validate: () => allowed },
        tools: [defineMcpTool({ name: 'account', handler: () => 'account' })],
      })
      await using client = await createMcpTestClient(endpoint, {
        era,
        headers: { authorization: 'Bearer token', 'x-mcp-tools': 'account' },
      })
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['account'])
      allowed = false
      await expect(client.callTool({ name: 'account' })).rejects.toThrow('Unauthorized')
      allowed = true
      expect((await client.callTool({ name: 'account' })).content).toEqual([
        { type: 'text', text: 'account' },
      ])
    })

    it(`changes between repeated, different, absent and empty selections (${era})`, async () => {
      const endpoint = handler()
      for (const header of [
        'get-component',
        'get-component',
        'search-icons',
        undefined,
        '',
        'get-component',
      ]) {
        await using client = await createMcpTestClient(endpoint, {
          era,
          ...(header === undefined ? {} : { headers: { 'x-mcp-tools': header } }),
        })
        expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
          header === undefined
            ? ['search-icons', 'get-component', 'get-migration-guide']
            : header
              ? [header]
              : [],
        )
      }
    })

    it(`isolates concurrent subsets and preserves registration order (${era})`, async () => {
      const endpoint = handler()
      await using first = await createMcpTestClient(endpoint, {
        era,
        headers: { 'x-mcp-tools': 'get-component,search-icons' },
      })
      await using second = await createMcpTestClient(endpoint, {
        era,
        headers: { 'x-mcp-tools': 'get-migration-guide' },
      })
      const [a, b] = await Promise.all([first.listTools(), second.listTools()])
      expect(a.tools.map((tool) => tool.name)).toEqual(['search-icons', 'get-component'])
      expect(b.tools.map((tool) => tool.name)).toEqual(['get-migration-guide'])
      await expect(first.callTool({ name: 'get-migration-guide' })).rejects.toThrow(
        'Tool not found',
      )
      expect((await second.callTool({ name: 'get-migration-guide' })).content).toEqual([
        { type: 'text', text: 'guide' },
      ])
      expect(endpoint.definitions.filter((definition) => definition.kind === 'tool')).toHaveLength(
        3,
      )
    })
  }

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

  it('does not reveal unknown names before auth', async () => {
    const guarded = createMcpHandler({
      auth: { tokens: ['secret'] },
      tools: [defineMcpTool({ name: 'search-icons', handler: () => 'icons' })],
    })
    const response = await guarded.fetch(
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

    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain('does-not-exist')
  })

  it('does not reveal unknown names before origin', async () => {
    const response = await handler().fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          origin: 'https://evil.example',
          'x-mcp-tools': 'does-not-exist',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
      }),
    )

    expect(response.status).toBe(403)
    expect(await response.text()).not.toContain('does-not-exist')
  })

  it('returns HTTP 400 for unknown names once the caller is allowed through', async () => {
    const guarded = createMcpHandler({
      auth: { tokens: ['secret'] },
      tools: [defineMcpTool({ name: 'search-icons', handler: () => 'icons' })],
    })
    const response = await guarded.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          authorization: 'Bearer secret',
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
