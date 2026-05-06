// Unit tests for the per-app routing surface (`attachTo` / `group` / `tags`).
// E2E coverage that wires this into `defineMcpHandler` lives alongside the
// other handler-organization fixtures, but the runtime contract — that the
// generated tool + resource carry the right `_meta.handler`, top-level `group`,
// and `tags` — is what callers ultimately filter on, and we lock that down
// here without paying the cost of a full Vite bundle.
import { describe, it, expect } from 'vitest'
import {
  defineMcpApp,
  _createAppTool,
  _createAppResource,
} from '../src/runtime/server/mcp/definitions/apps'

const ctx = { name: 'demo', html: '<!DOCTYPE html><html><head></head><body></body></html>' }

const callTool = (tool: ReturnType<typeof _createAppTool>, args: unknown = {}) =>
  tool.handler(args as Record<string, unknown>, {} as never)

describe('MCP App — attachTo (named-handler attribution)', () => {
  it('does not surface `_meta.handler` when no attribution is set', async () => {
    const app = defineMcpApp()
    const tool = _createAppTool(app, ctx)

    expect(tool._meta?.handler).toBeUndefined()

    const result = await callTool(tool) as { _meta?: Record<string, unknown> }
    expect(result._meta?.handler).toBeUndefined()
  })

  it('surfaces `attachTo` as `_meta.handler` on the tool definition + each call result', async () => {
    const app = defineMcpApp({ attachTo: 'finder' })
    const tool = _createAppTool(app, ctx)

    expect(tool._meta?.handler).toBe('finder')

    const result = await callTool(tool) as { _meta?: Record<string, unknown> }
    expect(result._meta?.handler).toBe('finder')
  })

  it('surfaces `attachTo` as `_meta.handler` on the resource + its read contents', async () => {
    const app = defineMcpApp({ attachTo: 'finder' })
    const resource = _createAppResource(app, ctx)

    expect(resource._meta?.handler).toBe('finder')

    const read = await resource.handler(new URL('ui://mcp-app/demo'), {} as never, {} as never)
    const c = read.contents?.[0] as { _meta?: Record<string, unknown> }
    expect(c?._meta?.handler).toBe('finder')
  })

  it('preserves user `_meta` keys when attribution is added (no clobbering)', async () => {
    const app = defineMcpApp({
      attachTo: 'finder',
      _meta: { 'openai/widgetAccessible': false, 'custom': 'value' },
    })
    const tool = _createAppTool(app, ctx)

    expect(tool._meta?.handler).toBe('finder')
    expect(tool._meta?.custom).toBe('value')
  })
})

describe('MCP App — group (top-level + filterable)', () => {
  it('forwards `group` to the tool definition as a top-level field', () => {
    const app = defineMcpApp({ group: 'stays' })
    const tool = _createAppTool(app, ctx)
    expect(tool.group).toBe('stays')
  })

  it('forwards `group` to the resource definition as a top-level field', () => {
    const app = defineMcpApp({ group: 'stays' })
    const resource = _createAppResource(app, ctx)
    expect(resource.group).toBe('stays')
  })

  it('omits `group` entirely when not provided (keeps existing summaries clean)', () => {
    const tool = _createAppTool(defineMcpApp(), ctx)
    expect(tool.group).toBeUndefined()
  })
})

describe('MCP App — tags (top-level + filterable)', () => {
  it('forwards `tags` to the tool definition as a top-level field', () => {
    const app = defineMcpApp({ tags: ['searchable', 'demo'] })
    const tool = _createAppTool(app, ctx)
    expect(tool.tags).toEqual(['searchable', 'demo'])
  })

  it('forwards `tags` to the resource definition as a top-level field', () => {
    const app = defineMcpApp({ tags: ['searchable'] })
    const resource = _createAppResource(app, ctx)
    expect(resource.tags).toEqual(['searchable'])
  })
})

describe('MCP App — combined routing surface', () => {
  it('lets a single app declare attachTo + group + tags simultaneously', async () => {
    const app = defineMcpApp({
      attachTo: 'finder',
      group: 'stays',
      tags: ['searchable', 'public'],
    })
    const tool = _createAppTool(app, ctx)
    const resource = _createAppResource(app, ctx)

    expect(tool._meta?.handler).toBe('finder')
    expect(tool.group).toBe('stays')
    expect(tool.tags).toEqual(['searchable', 'public'])

    expect(resource._meta?.handler).toBe('finder')
    expect(resource.group).toBe('stays')
    expect(resource.tags).toEqual(['searchable', 'public'])

    const result = await callTool(tool) as { _meta?: Record<string, unknown> }
    expect(result._meta?.handler).toBe('finder')
  })
})
