import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  formatSearchResults,
  generateToolCatalog,
  generateTypesFromTools,
  sanitizeToolName,
} from '../src/runtime/server/mcp/codemode/types'
import { buildDispatchFunctions, createCodemodeTools, disposeCodeMode } from '../src/runtime/server/mcp/codemode/index'
import { normalizeCode } from '../src/runtime/server/mcp/codemode/executor'
import { isCallToolResult } from '../src/runtime/server/mcp/definitions/results'
import type { McpRequestExtra } from '../src/runtime/server/mcp/definitions/sdk-extra'
import type { McpToolDefinition, McpToolDefinitionListItem } from '../src/runtime/server/mcp/definitions/tools'

vi.mock('../src/runtime/server/mcp/definitions/cache', () => ({
  createCacheOptions: () => ({}),
  wrapWithCache: <T>(fn: T) => fn,
}))

function mockMcpExtra(): McpRequestExtra {
  return {
    signal: new AbortController().signal,
    requestId: 1,
    sendNotification: async () => {},
    sendRequest: (async () => ({})) as McpRequestExtra['sendRequest'],
  }
}

function makeTool(
  name: string,
  description: string,
  inputSchema?: Record<string, z.ZodTypeAny>,
): McpToolDefinition {
  return {
    name,
    description,
    inputSchema: inputSchema || {},
    handler: async () => ({ content: [{ type: 'text' as const, text: 'ok' }] }),
  }
}

function makeToolWithOutput(
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
  outputSchema: Record<string, z.ZodTypeAny>,
): McpToolDefinition {
  return {
    name,
    description,
    inputSchema,
    outputSchema,
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
]

afterEach(() => {
  disposeCodeMode()
})

describe('sanitizeToolName', () => {
  it('sanitizes invalid identifier shapes', () => {
    expect(sanitizeToolName('get-user')).toBe('get_user')
    expect(sanitizeToolName('123abc')).toBe('_123abc')
    expect(sanitizeToolName('delete')).toBe('delete_')
  })
})

describe('generateTypesFromTools', () => {
  it('generates codemode declarations with inline description comments', () => {
    const { typeDefinitions, toolNameMap } = generateTypesFromTools(sampleTools)

    expect(typeDefinitions).toContain('declare const codemode')
    expect(typeDefinitions).toContain('get_user')
    expect(typeDefinitions).toContain('// Get a user by ID')
    expect(toolNameMap.get('get_user')).toBe('get-user')
  })

  it('generates output types from outputSchema', () => {
    const tools = [
      makeToolWithOutput('create-item', 'Create item', { title: z.string() }, { id: z.string(), ok: z.boolean() }),
      makeToolWithOutput('get-report', 'Get report', {}, {
        id: z.string(),
        title: z.string(),
        status: z.enum(['draft', 'published']),
        views: z.number(),
      }),
    ]
    const { typeDefinitions } = generateTypesFromTools(tools)

    expect(typeDefinitions).toContain('Promise<{ id: string; ok: boolean }>')
    expect(typeDefinitions).toContain('interface GetReportOutput')
    expect(typeDefinitions).toContain('Promise<GetReportOutput>')
  })

  it('warns on sanitized name collisions and keeps last tool', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { toolNameMap } = generateTypesFromTools([
      makeTool('get-user', 'A'),
      makeTool('get_user', 'B'),
    ])
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('both sanitize to "get_user"'))
    expect(toolNameMap.get('get_user')).toBe('get_user') // last wins
    warnSpy.mockRestore()
  })
})

describe('generateToolCatalog', () => {
  it('keeps richer descriptions in catalog signatures', () => {
    const tools = [makeToolWithOutput('create-item', 'Create item', { title: z.string() }, { id: z.string(), ok: z.boolean() })]
    const { entries } = generateToolCatalog(tools)

    expect(entries[0]!.signature).toContain('Promise<{ id: string; ok: boolean }>')
    expect(entries[0]!.signature).toContain('// Create item')
  })

  it('formats search results with signatures', () => {
    const { entries } = generateToolCatalog(sampleTools)
    const formatted = formatSearchResults(entries, '', entries.length)

    expect(formatted).toContain('All 4 tools:')
    expect(formatted).toContain('codemode.get_user')
  })
})

describe('createCodemodeTools', () => {
  it('creates a single code tool in standard mode', () => {
    const [codeTool] = createCodemodeTools(sampleTools)

    expect(codeTool!.name).toBe('code')
    expect(codeTool!.description).toContain('declare const codemode')
  })

  it('creates search plus code in progressive mode', () => {
    const tools = createCodemodeTools(sampleTools, { progressive: true })

    expect(tools.map(tool => tool.name)).toEqual(['search', 'code'])
    expect(tools[1]!.description).not.toContain('declare const codemode')
  })

  it('omits the example block when many tools exist', () => {
    const manyTools = Array.from({ length: 11 }, (_, index) =>
      makeTool(`tool-${index + 1}`, `Tool ${index + 1}`, { id: z.string() }),
    )
    const [codeTool] = createCodemodeTools(manyTools)

    expect(codeTool!.description).not.toContain('Example:')
  })

  it('adds outputSchema to the code tool', () => {
    const [codeTool] = createCodemodeTools(sampleTools)
    const outputSchema = codeTool!.outputSchema!

    expect(outputSchema.ok).toBeDefined()
    expect(outputSchema.result).toBeDefined()
    expect(outputSchema.error).toBeDefined()
    expect(outputSchema.logs).toBeDefined()
    expect(outputSchema.durationMs).toBeDefined()
  })
})

describe('buildDispatchFunctions', () => {
  it('prefers structuredContent over text content', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'create-item',
      description: 'Create item',
      inputSchema: { title: z.string() },
      handler: async () => ({
        structuredContent: { ok: true, data: { id: 'abc123' } },
        content: [{ type: 'text' as const, text: 'Created item successfully' }],
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.create_item!({ title: 'Test' })).resolves.toEqual({ ok: true, data: { id: 'abc123' } })
  })

  it('preserves plain text exactly instead of JSON parsing it', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'get-code',
      description: 'Get code',
      inputSchema: {},
      handler: async () => ({
        content: [{ type: 'text' as const, text: '123' }],
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.get_code!({})).resolves.toBe('123')
  })

  it('preserves native plain object returns', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'workspace-overview',
      description: 'Workspace overview',
      inputSchema: {},
      handler: async () => ({ ok: true, data: { total: 3 } }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.workspace_overview!({})).resolves.toEqual({ ok: true, data: { total: 3 } })
  })

  it('normalizes thrown errors into tool-error sentinels', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'delete-item',
      description: 'Delete item',
      inputSchema: { id: z.string() },
      handler: async () => {
        throw new Error('Item not found')
      },
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.delete_item!({ id: 'missing' })).resolves.toEqual({
      __mcp_toolkit_error__: true,
      message: 'Item not found',
      tool: 'delete_item',
      details: undefined,
    })
  })

  it('passes the real MCP extra into inner tool handlers', async () => {
    const extra = mockMcpExtra()
    const tools: McpToolDefinitionListItem[] = [{
      name: 'inspect-extra',
      description: 'Inspect extra',
      inputSchema: { id: z.string() },
      handler: async (_args, receivedExtra) => ({
        requestId: receivedExtra.requestId,
        sameSignal: receivedExtra.signal === extra.signal,
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, extra)

    await expect(fns.inspect_extra!({ id: '1' })).resolves.toEqual({
      requestId: 1,
      sameSignal: true,
    })
  })

  it('passes extra as second argument for empty-schema tools', async () => {
    const extra = mockMcpExtra()
    const tools: McpToolDefinitionListItem[] = [{
      name: 'empty-schema-tool',
      description: 'Tool with empty schema',
      inputSchema: {},
      handler: async (_args: Record<string, never>, receivedExtra: McpRequestExtra) => ({
        hasExtra: receivedExtra !== undefined,
        requestId: receivedExtra.requestId,
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, extra)

    await expect(fns.empty_schema_tool!({})).resolves.toEqual({
      hasExtra: true,
      requestId: 1,
    })
  })

  it('passes extra as sole argument for undefined-schema tools', async () => {
    const extra = mockMcpExtra()
    const tools: McpToolDefinitionListItem[] = [{
      name: 'no-schema-tool',
      description: 'Tool without schema',
      handler: async (receivedExtra: McpRequestExtra) => ({
        hasExtra: receivedExtra !== undefined,
        requestId: receivedExtra.requestId,
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, extra)

    await expect(fns.no_schema_tool!({})).resolves.toEqual({
      hasExtra: true,
      requestId: 1,
    })
  })
})

describe('code tool envelope', () => {
  it('returns structured success envelopes', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'get-user',
      description: 'Get user',
      inputSchema: { id: z.string() },
      handler: async (args: { id: string }) => ({
        id: args.id,
        active: true,
      }),
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.get_user({ id: "u1" })' }, mockMcpExtra()) as {
      isError?: boolean
      structuredContent?: unknown
    }

    expect(result.isError).toBe(false)
    expect(result.structuredContent).toEqual({
      ok: true,
      result: { id: 'u1', active: true },
      durationMs: expect.any(Number),
    })
  })

  it('returns structured error envelopes', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'delete-item',
      description: 'Delete item',
      inputSchema: { id: z.string() },
      handler: async () => {
        throw new Error('Item not found')
      },
    }]
    const [codeTool] = createCodemodeTools(tools)
    const result = await codeTool!.handler!({ code: 'return await codemode.delete_item({ id: "missing" })' }, mockMcpExtra()) as {
      isError?: boolean
      structuredContent?: unknown
    }

    expect(result.isError).toBe(true)
    expect(result.structuredContent).toEqual({
      ok: false,
      error: 'Item not found',
      durationMs: expect.any(Number),
    })
  })
})

describe('normalizeCode', () => {
  it('normalizes common wrapper formats', () => {
    expect(normalizeCode('```javascript\nconst x = 1;\n```')).toBe('const x = 1;')
    expect(normalizeCode('async () => codemode.get_user({ id: "1" })')).toBe('return codemode.get_user({ id: "1" });')
    expect(normalizeCode('export default async () => {\n  return 1;\n}')).toBe('return 1;')
  })
})

describe('disposeCodeMode', () => {
  it('is exported and callable', () => {
    expect(() => disposeCodeMode()).not.toThrow()
  })
})

describe('isCallToolResult', () => {
  it('matches objects with content array', () => {
    expect(isCallToolResult({ content: [{ type: 'text', text: 'hi' }] })).toBe(true)
  })

  it('matches objects with structuredContent', () => {
    expect(isCallToolResult({ structuredContent: { data: 1 } })).toBe(true)
  })

  it('matches objects with boolean isError', () => {
    expect(isCallToolResult({ isError: true })).toBe(true)
    expect(isCallToolResult({ isError: false })).toBe(true)
  })

  it('rejects objects with non-boolean isError', () => {
    expect(isCallToolResult({ isError: 'yes' })).toBe(false)
    expect(isCallToolResult({ isError: 0 })).toBe(false)
  })

  it('rejects plain objects with incidental properties', () => {
    expect(isCallToolResult({ content: 'not-an-array' })).toBe(false)
    expect(isCallToolResult({ ok: true, data: 123 })).toBe(false)
  })
})

describe('enum escaping in type generation', () => {
  it('escapes special characters in enum values', () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'get-quote',
      description: 'Get a quote',
      inputSchema: {
        style: z.enum(['he said "hello"', 'it\'s fine', 'back\\slash']),
      },
      handler: async () => 'ok',
    }]
    const { typeDefinitions } = generateTypesFromTools(tools)

    expect(typeDefinitions).toContain('"he said \\"hello\\""')
    expect(typeDefinitions).toContain('"it\'s fine"')
    expect(typeDefinitions).toContain('"back\\\\slash"')
  })
})

describe('buildDispatchFunctions error handling', () => {
  it('normalizes isError CallToolResult into tool-error sentinel', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'fail-tool',
      description: 'Fails with isError',
      inputSchema: {},
      handler: async () => ({
        isError: true,
        content: [{ type: 'text' as const, text: 'Permission denied' }],
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.fail_tool!({})).resolves.toEqual({
      __mcp_toolkit_error__: true,
      message: 'Permission denied',
      tool: 'fail_tool',
      details: undefined,
    })
  })

  it('preserves structuredContent details in error sentinel', async () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'structured-fail',
      description: 'Fails with structured error',
      inputSchema: {},
      handler: async () => ({
        isError: true,
        structuredContent: { code: 'FORBIDDEN', reason: 'Not authorized' },
        content: [{ type: 'text' as const, text: 'Permission denied' }],
      }),
    }]
    const { toolNameMap } = generateTypesFromTools(tools)
    const fns = buildDispatchFunctions(tools, toolNameMap, mockMcpExtra())

    await expect(fns.structured_fail!({})).resolves.toEqual({
      __mcp_toolkit_error__: true,
      message: 'Permission denied',
      tool: 'structured_fail',
      details: { code: 'FORBIDDEN', reason: 'Not authorized' },
    })
  })
})

describe('annotation surfacing', () => {
  it('surfaces readOnlyHint as [read-only] tag', () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'list-items',
      description: 'List items',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      handler: async () => 'ok',
    }]
    const { typeDefinitions } = generateTypesFromTools(tools)
    expect(typeDefinitions).toContain('[read-only]')
  })

  it('surfaces destructiveHint as [destructive] tag', () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'delete-item',
      description: 'Delete item',
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
      handler: async () => 'ok',
    }]
    const { typeDefinitions } = generateTypesFromTools(tools)
    expect(typeDefinitions).toContain('[destructive]')
  })

  it('surfaces idempotentHint as [idempotent] tag', () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'update-item',
      description: 'Update item',
      inputSchema: { id: z.string() },
      annotations: { idempotentHint: true },
      handler: async () => 'ok',
    }]
    const { typeDefinitions } = generateTypesFromTools(tools)
    expect(typeDefinitions).toContain('[idempotent]')
  })

  it('combines multiple annotation tags', () => {
    const tools: McpToolDefinitionListItem[] = [{
      name: 'safe-read',
      description: 'Safe read',
      inputSchema: {},
      annotations: { readOnlyHint: true, idempotentHint: true },
      handler: async () => 'ok',
    }]
    const { typeDefinitions } = generateTypesFromTools(tools)
    expect(typeDefinitions).toContain('[read-only] [idempotent] Safe read')
  })
})

describe('grouped search results', () => {
  it('groups tools by group field with section headers', () => {
    const tools: McpToolDefinitionListItem[] = [
      { name: 'create-runbook', description: 'Create', inputSchema: {}, group: 'workspace', handler: async () => 'ok' },
      { name: 'list-runbooks', description: 'List', inputSchema: {}, group: 'workspace', handler: async () => 'ok' },
      { name: 'search-public', description: 'Search', inputSchema: {}, group: 'public', handler: async () => 'ok' },
    ]
    const { entries } = generateToolCatalog(tools)
    const formatted = formatSearchResults(entries, '', entries.length)

    expect(formatted).toContain('## workspace')
    expect(formatted).toContain('## public')
    expect(formatted).toContain('codemode.create_runbook')
    expect(formatted).toContain('codemode.search_public')
  })

  it('renders mixed grouped and ungrouped tools correctly', () => {
    const tools: McpToolDefinitionListItem[] = [
      { name: 'create-item', description: 'Create', inputSchema: {}, group: 'items', handler: async () => 'ok' },
      { name: 'get-status', description: 'Status', inputSchema: {}, handler: async () => 'ok' },
    ]
    const { entries } = generateToolCatalog(tools)
    const formatted = formatSearchResults(entries, '', entries.length)

    expect(formatted).toContain('## items')
    expect(formatted).toContain('codemode.get_status')
  })

  it('renders flat when no tools have groups (backward compat)', () => {
    const { entries } = generateToolCatalog(sampleTools)
    const formatted = formatSearchResults(entries, '', entries.length)

    expect(formatted).not.toContain('##')
    expect(formatted).toContain('codemode.get_user')
  })
})

describe('backward compatibility', () => {
  it('tools without annotations work identically', () => {
    const { typeDefinitions } = generateTypesFromTools(sampleTools)

    expect(typeDefinitions).toContain('get_user')
    expect(typeDefinitions).toContain('declare const codemode')
  })
})

describe('annotation vs description comment boundary', () => {
  it('preserves descriptions for all tools, with annotation tags prepended when present', () => {
    const tools: McpToolDefinitionListItem[] = [
      {
        name: 'annotated-tool',
        description: 'This has annotations',
        inputSchema: {},
        annotations: { readOnlyHint: true },
        handler: async () => 'ok',
      },
      {
        name: 'plain-tool',
        description: 'This has no annotations',
        inputSchema: {},
        handler: async () => 'ok',
      },
    ]
    const { typeDefinitions } = generateTypesFromTools(tools)

    // Annotated tool: tag + description preserved
    expect(typeDefinitions).toContain('[read-only] This has annotations')
    // Plain tool: description also preserved
    expect(typeDefinitions).toContain('// This has no annotations')
  })
})
