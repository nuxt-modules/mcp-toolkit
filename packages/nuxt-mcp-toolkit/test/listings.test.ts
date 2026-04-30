import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

vi.mock('#nuxt-mcp-toolkit/tools.mjs', () => ({
  tools: [
    {
      name: 'explicit-tool',
      title: 'Explicit Tool',
      description: 'Has explicit name and title',
      tags: ['public'],
      inputSchema: { id: z.string() },
      handler: async () => 'ok',
    },
    {
      description: 'Auto-generated from filename',
      tags: ['public', 'docs'],
      _meta: { filename: 'list-documentation.ts' },
      handler: async () => 'ok',
    },
    {
      description: 'Inferred group from subdirectory',
      tags: ['destructive'],
      _meta: { filename: 'delete-user.ts', group: 'admin', handler: 'admin' },
      handler: async () => 'ok',
      enabled: (event: { context?: { role?: string } }) => event.context?.role === 'admin',
    },
    {
      description: 'Another admin tool',
      _meta: { filename: 'reset-cache.ts', group: 'admin', handler: 'admin' },
      handler: async () => 'ok',
    },
    {
      description: 'A content tool',
      _meta: { filename: 'list-pages.ts', group: 'content', handler: 'public' },
      handler: async () => 'ok',
    },
  ],
}))

vi.mock('#nuxt-mcp-toolkit/resources.mjs', () => ({
  resources: [
    {
      name: 'app-config',
      description: 'Application config',
      uri: 'app://config',
      tags: ['internal'],
      handler: async (uri: URL) => ({ contents: [{ uri: uri.toString(), text: '{}' }] }),
    },
    {
      _meta: { filename: 'project-readme.ts' },
      uri: { uriTemplate: 'file:///project/{section}.md' },
      handler: async () => ({ contents: [] }),
    },
  ],
}))

vi.mock('#nuxt-mcp-toolkit/prompts.mjs', () => ({
  prompts: [
    {
      _meta: { filename: 'greeting-message.ts' },
      description: 'A greeting prompt',
      handler: async () => 'hello',
    },
  ],
}))

const {
  listMcpTools,
  listMcpResources,
  listMcpPrompts,
  listMcpDefinitions,
  getMcpTools,
  getMcpResources,
  getMcpPrompts,
} = await import('../src/runtime/server/mcp/definitions/listings')

describe('listings helpers', () => {
  describe('listMcpTools', () => {
    it('returns explicit and auto-generated names with titles, descriptions, tags, and handler attribution', async () => {
      const tools = await listMcpTools()
      expect(tools).toEqual([
        {
          name: 'explicit-tool',
          title: 'Explicit Tool',
          description: 'Has explicit name and title',
          tags: ['public'],
        },
        {
          name: 'list-documentation',
          title: 'List Documentation',
          description: 'Auto-generated from filename',
          tags: ['public', 'docs'],
        },
        {
          name: 'delete-user',
          title: 'Delete User',
          description: 'Inferred group from subdirectory',
          group: 'admin',
          tags: ['destructive'],
          handler: 'admin',
        },
        {
          name: 'reset-cache',
          title: 'Reset Cache',
          description: 'Another admin tool',
          group: 'admin',
          handler: 'admin',
        },
        {
          name: 'list-pages',
          title: 'List Pages',
          description: 'A content tool',
          group: 'content',
          handler: 'public',
        },
      ])
    })

    it('does not return any handler functions or zod schemas (JSON-friendly)', async () => {
      const tools = await listMcpTools()
      for (const tool of tools) {
        expect(JSON.stringify(tool)).not.toContain('function')
      }
    })

    it('filters out tools whose enabled() guard returns false', async () => {
      const event = { context: { role: 'guest' } } as never
      const tools = await listMcpTools({ event })
      expect(tools.map(t => t.name)).toEqual([
        'explicit-tool',
        'list-documentation',
        'reset-cache',
        'list-pages',
      ])
    })

    it('keeps tools whose enabled() guard returns true', async () => {
      const event = { context: { role: 'admin' } } as never
      const tools = await listMcpTools({ event })
      expect(tools.map(t => t.name)).toEqual([
        'explicit-tool',
        'list-documentation',
        'delete-user',
        'reset-cache',
        'list-pages',
      ])
    })

    it('filters by a single group', async () => {
      const tools = await listMcpTools({ group: 'admin' })
      expect(tools.map(t => t.name)).toEqual(['delete-user', 'reset-cache'])
    })

    it('filters by multiple groups (OR-match)', async () => {
      const tools = await listMcpTools({ group: ['admin', 'content'] })
      expect(tools.map(t => t.name)).toEqual(['delete-user', 'reset-cache', 'list-pages'])
    })

    it('filters by a single tag', async () => {
      const tools = await listMcpTools({ tags: 'destructive' })
      expect(tools.map(t => t.name)).toEqual(['delete-user'])
    })

    it('filters by multiple tags (OR-match)', async () => {
      const tools = await listMcpTools({ tags: ['public', 'destructive'] })
      expect(tools.map(t => t.name)).toEqual(['explicit-tool', 'list-documentation', 'delete-user'])
    })

    it('combines group, tags, and event filters', async () => {
      const event = { context: { role: 'admin' } } as never
      const tools = await listMcpTools({ event, group: 'admin', tags: 'destructive' })
      expect(tools.map(t => t.name)).toEqual(['delete-user'])
    })

    it('returns an empty list when filters match nothing', async () => {
      const tools = await listMcpTools({ group: 'unknown-group' })
      expect(tools).toEqual([])
    })

    it('filters by a single handler attribution', async () => {
      const tools = await listMcpTools({ handler: 'admin' })
      expect(tools.map(t => t.name)).toEqual(['delete-user', 'reset-cache'])
    })

    it('filters by multiple handlers (OR-match)', async () => {
      const tools = await listMcpTools({ handler: ['admin', 'public'] })
      expect(tools.map(t => t.name)).toEqual(['delete-user', 'reset-cache', 'list-pages'])
    })

    it('returns only orphan tools with `orphansOnly`', async () => {
      const tools = await listMcpTools({ orphansOnly: true })
      expect(tools.map(t => t.name)).toEqual(['explicit-tool', 'list-documentation'])
    })

    it('combines handler attribution with tag/group filters', async () => {
      const tools = await listMcpTools({ handler: 'admin', tags: 'destructive' })
      expect(tools.map(t => t.name)).toEqual(['delete-user'])
    })
  })

  describe('listMcpResources', () => {
    it('summarizes static and template-based resources, including the URI', async () => {
      const resources = await listMcpResources()
      expect(resources).toEqual([
        {
          name: 'app-config',
          description: 'Application config',
          uri: 'app://config',
          tags: ['internal'],
        },
        {
          name: 'project-readme',
          title: 'Project Readme',
          uri: 'file:///project/{section}.md',
        },
      ])
    })

    it('filters resources by tags', async () => {
      const resources = await listMcpResources({ tags: 'internal' })
      expect(resources.map(r => r.name)).toEqual(['app-config'])
    })
  })

  describe('listMcpPrompts', () => {
    it('summarizes prompts with auto-generated name and title', async () => {
      const prompts = await listMcpPrompts()
      expect(prompts).toEqual([
        {
          name: 'greeting-message',
          title: 'Greeting Message',
          description: 'A greeting prompt',
        },
      ])
    })
  })

  describe('getMcp* (raw definitions)', () => {
    it('getMcpTools returns the raw definition objects, including handlers', async () => {
      const tools = await getMcpTools({ handler: 'admin' })
      expect(tools).toHaveLength(2)
      for (const tool of tools) {
        expect(typeof tool.handler).toBe('function')
      }
    })

    it('getMcpTools applies enabled() guards when an event is passed', async () => {
      const event = { context: { role: 'guest' } } as never
      const tools = await getMcpTools({ event })
      expect(tools.find(t => t._meta?.filename === 'delete-user.ts')).toBeUndefined()
    })

    it('getMcpResources and getMcpPrompts mirror the listing helpers', async () => {
      const resources = await getMcpResources()
      const prompts = await getMcpPrompts()
      expect(resources).toHaveLength(2)
      expect(prompts).toHaveLength(1)
    })
  })

  describe('listMcpDefinitions', () => {
    it('returns tools, resources, and prompts in one call', async () => {
      const summary = await listMcpDefinitions()
      expect(summary.tools).toHaveLength(5)
      expect(summary.resources).toHaveLength(2)
      expect(summary.prompts).toHaveLength(1)
    })

    it('applies enabled() guards to every collection when given an event', async () => {
      const event = { context: { role: 'guest' } } as never
      const summary = await listMcpDefinitions({ event })
      expect(summary.tools.map(t => t.name)).toEqual([
        'explicit-tool',
        'list-documentation',
        'reset-cache',
        'list-pages',
      ])
      expect(summary.resources).toHaveLength(2)
      expect(summary.prompts).toHaveLength(1)
    })

    it('applies group/tags filters uniformly across all collections', async () => {
      const summary = await listMcpDefinitions({ group: 'admin' })
      expect(summary.tools.map(t => t.name)).toEqual(['delete-user', 'reset-cache'])
      expect(summary.resources).toEqual([])
      expect(summary.prompts).toEqual([])
    })
  })
})
