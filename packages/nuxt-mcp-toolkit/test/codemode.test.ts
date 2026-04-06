import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  generateTypesFromTools,
  generateToolCatalog,
  searchToolCatalog,
  formatSearchResults,
  sanitizeToolName,
} from '../src/runtime/server/mcp/codemode/types'
import { createCodemodeTools, disposeCodeMode } from '../src/runtime/server/mcp/codemode/index'
import { normalizeCode } from '../src/runtime/server/mcp/codemode/executor'
import type { McpToolDefinition, McpToolDefinitionListItem } from '../src/runtime/server/mcp/definitions/tools'
import type { McpRequestExtra } from '../src/runtime/server/mcp/definitions/sdk-extra'

function mockMcpExtra(): McpRequestExtra {
  return {
    signal: new AbortController().signal,
    requestId: 0,
    sendNotification: async () => {},
    sendRequest: (async () => ({})) as McpRequestExtra['sendRequest'],
  }
}

function makeTool(name: string, description: string, inputSchema?: Record<string, z.ZodTypeAny>): McpToolDefinition {
  return {
    name,
    description,
    inputSchema: inputSchema || {},
    handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
  }
}

const sampleTools = [
  makeTool('get-user', 'Get a user by ID', { id: z.string() }),
  makeTool('list-users', 'List all users'),
  makeTool('create-todo', 'Create a new todo item', {
    title: z.string(),
    completed: z.boolean().optional(),
  }),
  makeTool('delete-todo', 'Delete a todo by ID', { id: z.string() }),
  makeTool('search-products', 'Search products catalog', {
    query: z.string(),
    category: z.string().optional(),
    limit: z.number().optional(),
  }),
]

describe('sanitizeToolName', () => {
  it('replaces hyphens with underscores', () => {
    expect(sanitizeToolName('get-user')).toBe('get_user')
  })

  it('prefixes names starting with digits', () => {
    expect(sanitizeToolName('123abc')).toBe('_123abc')
  })

  it('appends underscore to reserved words', () => {
    expect(sanitizeToolName('delete')).toBe('delete_')
    expect(sanitizeToolName('class')).toBe('class_')
  })

  it('passes through valid names unchanged', () => {
    expect(sanitizeToolName('myTool')).toBe('myTool')
  })
})

describe('generateTypesFromTools', () => {
  it('generates type definitions for all tools', () => {
    const { typeDefinitions, toolNameMap } = generateTypesFromTools(sampleTools)

    expect(typeDefinitions).toContain('declare const codemode')
    expect(typeDefinitions).toContain('get_user')
    expect(typeDefinitions).toContain('list_users')
    expect(typeDefinitions).toContain('create_todo')
    expect(toolNameMap.size).toBe(5)
    expect(toolNameMap.get('get_user')).toBe('get-user')
  })

  it('maps sanitized names to originals', () => {
    const { toolNameMap } = generateTypesFromTools(sampleTools)

    expect(toolNameMap.get('delete_todo')).toBe('delete-todo')
    expect(toolNameMap.get('search_products')).toBe('search-products')
  })
})

describe('generateToolCatalog', () => {
  it('creates catalog entries for all tools', () => {
    const { entries, toolNameMap } = generateToolCatalog(sampleTools)

    expect(entries).toHaveLength(5)
    expect(toolNameMap.size).toBe(5)
  })

  it('preserves tool descriptions', () => {
    const { entries } = generateToolCatalog(sampleTools)
    const getUserEntry = entries.find(e => e.name === 'get_user')

    expect(getUserEntry).toBeDefined()
    expect(getUserEntry!.description).toBe('Get a user by ID')
  })

  it('includes method signatures', () => {
    const { entries } = generateToolCatalog(sampleTools)
    const createTodoEntry = entries.find(e => e.name === 'create_todo')

    expect(createTodoEntry).toBeDefined()
    expect(createTodoEntry!.signature).toContain('create_todo')
    expect(createTodoEntry!.signature).toContain('Promise<unknown>')
  })
})

describe('searchToolCatalog', () => {
  const { entries } = generateToolCatalog(sampleTools)

  it('finds tools by name keyword', () => {
    const results = searchToolCatalog(entries, 'user')
    expect(results).toHaveLength(2)
    expect(results.map(r => r.name)).toContain('get_user')
    expect(results.map(r => r.name)).toContain('list_users')
  })

  it('finds tools by description keyword', () => {
    const results = searchToolCatalog(entries, 'catalog')
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('search_products')
  })

  it('supports multi-word queries (AND logic)', () => {
    const results = searchToolCatalog(entries, 'todo create')
    expect(results).toHaveLength(1)
    expect(results[0]!.name).toBe('create_todo')
  })

  it('returns all entries for empty query', () => {
    const results = searchToolCatalog(entries, '')
    expect(results).toHaveLength(5)
  })

  it('is case-insensitive', () => {
    const results = searchToolCatalog(entries, 'USER')
    expect(results).toHaveLength(2)
  })

  it('returns empty array for no matches', () => {
    const results = searchToolCatalog(entries, 'nonexistent')
    expect(results).toHaveLength(0)
  })

  it('ranks exact name matches highest', () => {
    const tools = [
      makeTool('user', 'A tool called user'),
      makeTool('get-user', 'Get a user by ID'),
      makeTool('manage-data', 'Manages user data'),
    ]
    const { entries: catalog } = generateToolCatalog(tools)
    const results = searchToolCatalog(catalog, 'user')

    expect(results[0]!.name).toBe('user')
  })

  it('ranks name-prefix matches before description matches', () => {
    const tools = [
      makeTool('data-handler', 'Handles user requests'),
      makeTool('user-settings', 'Manage settings'),
    ]
    const { entries: catalog } = generateToolCatalog(tools)
    const results = searchToolCatalog(catalog, 'user')

    expect(results[0]!.name).toBe('user_settings')
  })
})

describe('formatSearchResults', () => {
  const { entries } = generateToolCatalog(sampleTools)

  it('formats matching results with count', () => {
    const matches = searchToolCatalog(entries, 'user')
    const result = formatSearchResults(matches, 'user', entries.length)

    expect(result).toContain('Found 2/5 tools matching "user"')
    expect(result).toContain('codemode.')
  })

  it('formats no-match message with total count', () => {
    const result = formatSearchResults([], 'nonexistent', entries.length)

    expect(result).toContain('No tools found matching "nonexistent"')
    expect(result).toContain('5 tools available')
  })

  it('shows "All N tools" header when returning everything', () => {
    const result = formatSearchResults(entries, '', entries.length)

    expect(result).toContain('All 5 tools:')
  })
})

describe('createCodemodeTools', () => {
  it('creates a single code tool in standard mode', () => {
    const result = createCodemodeTools(sampleTools)

    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('code')
    expect(result[0]!.description).toContain('Available tools via')
    expect(result[0]!.description).toContain('get_user')
  })

  it('creates search + code tools in progressive mode', () => {
    const result = createCodemodeTools(sampleTools, { progressive: true })

    expect(result).toHaveLength(2)
    expect(result[0]!.name).toBe('search')
    expect(result[1]!.name).toBe('code')
  })

  it('does not embed type definitions in progressive code tool', () => {
    const result = createCodemodeTools(sampleTools, { progressive: true })
    const codeTool = result[1]!

    expect(codeTool.description).toContain('5 tools available')
    expect(codeTool.description).toContain('search')
    expect(codeTool.description).not.toContain('declare const codemode')
  })

  it('embeds all type definitions in standard code tool', () => {
    const result = createCodemodeTools(sampleTools)
    const codeTool = result[0]!

    expect(codeTool.description).toContain('declare const codemode')
    expect(codeTool.description).toContain('get_user')
    expect(codeTool.description).toContain('list_users')
  })

  it('uses custom description template in standard mode', () => {
    const result = createCodemodeTools(sampleTools, {
      description: 'My tools ({{count}}): {{types}}',
    })

    expect(result[0]!.description).toContain('My tools (5)')
    expect(result[0]!.description).toContain('declare const codemode')
  })

  it('uses custom description template in progressive mode', () => {
    const result = createCodemodeTools(sampleTools, {
      progressive: true,
      description: 'Search first, then execute. {{count}} available.',
    })

    expect(result[1]!.description).toBe('Search first, then execute. 5 available.')
  })

  it('search tool has readOnlyHint annotation', () => {
    const result = createCodemodeTools(sampleTools, { progressive: true })
    const searchTool = result[0]!

    expect(searchTool.annotations?.readOnlyHint).toBe(true)
    expect(searchTool.annotations?.destructiveHint).toBe(false)
  })
})

describe('buildDispatchFunctions — structuredContent handling', () => {
  it('returns structuredContent when present, not text content', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'create-item',
      description: 'Create an item',
      inputSchema: { title: z.string() },
      handler: async () => ({
        structuredContent: { ok: true, data: { id: 'abc123' } },
        content: [{ type: 'text' as const, text: 'Created item successfully' }],
      }),
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.create_item({ title: "Test" })' }, mockMcpExtra())
    const text = (result as { content: { text: string }[] }).content[0]!.text
    const parsed = JSON.parse(text)

    expect(parsed).toEqual({ ok: true, data: { id: 'abc123' } })
  })

  it('preserves typed fields (booleans, nested objects) from structuredContent', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'get-status',
      description: 'Get status',
      inputSchema: {},
      handler: async () => ({
        structuredContent: { active: true, count: 42, nested: { a: [1, 2] } },
        content: [{ type: 'text' as const, text: 'Status OK' }],
      }),
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.get_status()' }, mockMcpExtra())
    const text = (result as { content: { text: string }[] }).content[0]!.text
    const parsed = JSON.parse(text)

    expect(parsed.active).toBe(true)
    expect(parsed.count).toBe(42)
    expect(parsed.nested).toEqual({ a: [1, 2] })
  })

  it('enables operation chaining with structuredContent IDs', async () => {
    const tools: McpToolDefinitionListItem[] = [
      {
        name: 'create-item',
        description: 'Create an item',
        inputSchema: { title: z.string() },
        handler: async () => ({
          structuredContent: { ok: true, data: { id: 'xyz789' } },
          content: [{ type: 'text' as const, text: 'Created' }],
        }),
      },
      {
        name: 'update-item',
        description: 'Update an item',
        inputSchema: { id: z.string(), title: z.string() },
        handler: async (args: Record<string, unknown>) => ({
          structuredContent: { ok: true, data: { id: args.id, title: args.title } },
          content: [{ type: 'text' as const, text: `Updated ${args.id}` }],
        }),
      },
    ]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({
      code: `
        const created = await codemode.create_item({ title: "Test" });
        const updated = await codemode.update_item({ id: created.data.id, title: "Updated" });
        return updated;
      `,
    }, mockMcpExtra())
    const text = (result as { content: { text: string }[] }).content[0]!.text
    const parsed = JSON.parse(text)

    expect(parsed).toEqual({ ok: true, data: { id: 'xyz789', title: 'Updated' } })
  })

  it('falls back to text content when structuredContent is absent', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'echo',
      description: 'Echo text',
      inputSchema: { msg: z.string() },
      handler: async (args: Record<string, unknown>) => ({
        content: [{ type: 'text' as const, text: args.msg as string }],
      }),
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.echo({ msg: "hello" })' }, mockMcpExtra())
    const text = (result as { content: { text: string }[] }).content[0]!.text

    expect(text).toBe('hello')
  })

  it('handles structuredContent-only result (no content array)', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'data-only',
      description: 'Data only tool',
      inputSchema: {},
      handler: async () => ({
        structuredContent: { value: 99 },
      }),
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.data_only()' }, mockMcpExtra())
    const text = (result as { content: { text: string }[] }).content[0]!.text
    const parsed = JSON.parse(text)

    expect(parsed).toEqual({ value: 99 })
  })
})

describe('normalizeCode', () => {
  it('strips markdown fences', () => {
    const code = '```javascript\nconst x = 1;\n```'
    expect(normalizeCode(code)).toBe('const x = 1;')
  })

  it('unwraps async arrow function with block body', () => {
    const code = 'async () => {\n  return 42;\n}'
    expect(normalizeCode(code)).toBe('return 42;')
  })

  it('unwraps async arrow function with expression body', () => {
    const code = 'async () => codemode.get_user({ id: "1" })'
    expect(normalizeCode(code)).toBe('return codemode.get_user({ id: "1" });')
  })

  it('unwraps IIFE pattern', () => {
    const code = '(async () => {\n  const x = 1;\n  return x;\n})()'
    expect(normalizeCode(code)).toBe('const x = 1;\n  return x;')
  })

  it('unwraps named function + call pattern', () => {
    const code = 'async function main() {\n  return 42;\n}\nmain()'
    expect(normalizeCode(code)).toBe('return 42;')
  })

  it('strips export default prefix', () => {
    const code = 'export default async () => {\n  return 1;\n}'
    expect(normalizeCode(code)).toBe('return 1;')
  })

  it('passes through plain code unchanged', () => {
    const code = 'const result = await codemode.list_users();\nreturn result;'
    expect(normalizeCode(code)).toBe(code)
  })
})

describe('disposeCodeMode', () => {
  it('is exported and callable', () => {
    expect(typeof disposeCodeMode).toBe('function')
    expect(() => disposeCodeMode()).not.toThrow()
  })
})
