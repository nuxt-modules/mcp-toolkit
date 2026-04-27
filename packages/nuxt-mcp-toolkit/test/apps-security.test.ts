import { afterEach, describe, it, expect } from 'vitest'
import {
  defineMcpApp,
  buildAppResourceUri,
  assertSafeAppName,
  _createAppTool,
  _createAppResource,
  MCP_APP_MIME_TYPE,
} from '../src/runtime/server/mcp/definitions/apps'

const ctx = { name: 'demo', html: '<!DOCTYPE html><html><head></head><body></body></html>' }

const callTool = (tool: ReturnType<typeof _createAppTool>, args: unknown) =>
  tool.handler(args as Record<string, unknown>, {} as never)

const getHtml = (result: { content: Array<{ resource?: { text?: string } }> }) => {
  const text = result.content[0]?.resource?.text
  if (!text) throw new Error('expected resource text')
  return text
}

describe('MCP App — name validation', () => {
  it('rejects unsafe app names everywhere they could leak into a URI or filename', () => {
    expect(() => assertSafeAppName('color-picker')).not.toThrow()
    expect(() => assertSafeAppName('../etc/passwd')).toThrow(TypeError)
    expect(() => assertSafeAppName('Has Space')).toThrow(TypeError)
    expect(() => buildAppResourceUri('../escape')).toThrow(TypeError)
    expect(buildAppResourceUri('demo')).toBe('ui://mcp-app/demo')

    const app = defineMcpApp()
    expect(() => _createAppTool(app, { name: '../bad', html: '' })).toThrow(TypeError)
  })
})

describe('MCP App — security', () => {
  it('escapes injected JSON to prevent <script> breakout and XSS', async () => {
    const app = defineMcpApp({ csp: false })
    const tool = _createAppTool(app, ctx)
    const result = await callTool(tool, { payload: '</script><script>alert(1)</script>\u2028' })
    const html = getHtml(result as never)

    expect(html).not.toContain('</script><script>')
    expect(html).toContain('\\u003c')
    expect(html).toContain('\\u2028')
  })

  it('rejects oversized payloads instead of bricking the iframe', async () => {
    const app = defineMcpApp({
      csp: false,
      handler: () => ({ structuredContent: { blob: 'x'.repeat(2 * 1024 * 1024) } }),
    })
    const result = await callTool(_createAppTool(app, ctx), {}) as { isError?: boolean, content: Array<{ text: string }> }
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/exceeds .* bytes/)
  })

  it('emits a CSP, honors declared resource/connect domains, and rejects unsafe ones', async () => {
    const safe = defineMcpApp({
      csp: { resourceDomains: ['https://cdn.example.com'], connectDomains: ['https://api.example.com'] },
    })
    const safeHtml = getHtml(await callTool(_createAppTool(safe, ctx), {}) as never)
    expect(safeHtml).toMatch(/<meta http-equiv="Content-Security-Policy"/)
    expect(safeHtml).toContain(`default-src 'none'`)
    expect(safeHtml).toContain('https://cdn.example.com')
    expect(safeHtml).toContain('https://api.example.com')

    const unsafe = defineMcpApp({ csp: { resourceDomains: ['javascript:alert(1)'] } })
    const result = await callTool(_createAppTool(unsafe, ctx), {}) as { isError?: boolean, content: Array<{ text: string }> }
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/CSP domain/)
  })
})

describe('MCP App — spec metadata', () => {
  const originalEnv = process.env.NUXT_PUBLIC_APP_URL

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NUXT_PUBLIC_APP_URL
    else process.env.NUXT_PUBLIC_APP_URL = originalEnv
  })

  it('serves the spec MIME and exposes ui.resourceUri + ui.csp on tool and resource _meta', async () => {
    expect(MCP_APP_MIME_TYPE).toBe('text/html;profile=mcp-app')

    const app = defineMcpApp({ csp: { resourceDomains: ['https://images.example.com'] } })
    const tool = _createAppTool(app, ctx)
    const toolResult = await callTool(tool, {}) as {
      content: Array<{ resource?: { mimeType?: string, _meta?: Record<string, unknown> } }>
      _meta?: Record<string, unknown>
    }

    expect(toolResult.content[0]?.resource?.mimeType).toBe(MCP_APP_MIME_TYPE)
    const toolUi = toolResult._meta?.ui as Record<string, unknown> | undefined
    expect(toolUi?.resourceUri).toBe('ui://mcp-app/demo')
    expect(toolUi?.csp).toMatchObject({ resourceDomains: ['https://images.example.com'] })

    const resource = _createAppResource(app, ctx)
    const read = await resource.handler(new URL('ui://mcp-app/demo'), {} as never, {} as never)
    const c = read.contents?.[0] as { mimeType?: string, text?: string, _meta?: Record<string, unknown> }
    expect(c?.mimeType).toBe(MCP_APP_MIME_TYPE)
    expect(c?.text).toMatch(/Content-Security-Policy/)
    const resourceUi = c?._meta?.ui as Record<string, unknown> | undefined
    expect(resourceUi?.resourceUri).toBe('ui://mcp-app/demo')
    expect(resourceUi?.csp).toMatchObject({ resourceDomains: ['https://images.example.com'] })
  })

  it('auto-detects ui.domain and lets app metadata override it', async () => {
    process.env.NUXT_PUBLIC_APP_URL = 'demo.example.com'
    const detected = _createAppTool(defineMcpApp(), ctx)
    const detectedResult = await callTool(detected, {}) as { _meta?: Record<string, unknown> }
    expect((detectedResult._meta?.ui as Record<string, unknown>).domain).toBe('https://demo.example.com')

    const overridden = _createAppTool(defineMcpApp({
      _meta: { ui: { domain: 'https://custom.example.com' } },
    }), ctx)
    const overriddenResult = await callTool(overridden, {}) as { _meta?: Record<string, unknown> }
    expect((overriddenResult._meta?.ui as Record<string, unknown>).domain).toBe('https://custom.example.com')
  })
})

describe('MCP App — ChatGPT compat metadata', () => {
  // ChatGPT today gates widget rendering on `openai/*` keys instead of the
  // spec's `_meta.ui.*`. If these regress, the iframe stops showing up
  // entirely in ChatGPT — that's invisible to spec-pure tests, so we lock
  // them down explicitly. Drop this suite the day ChatGPT honors `_meta.ui`.
  it('mirrors ui.resourceUri + csp into openai/* keys on tool and resource _meta', async () => {
    const app = defineMcpApp({
      csp: { resourceDomains: ['https://cdn.example.com'], connectDomains: ['https://api.example.com'] },
    })

    const toolResult = await callTool(_createAppTool(app, ctx), {}) as { _meta?: Record<string, unknown> }
    expect(toolResult._meta?.['openai/outputTemplate']).toBe('ui://mcp-app/demo')
    expect(toolResult._meta?.['openai/widgetAccessible']).toBe(true)
    expect(toolResult._meta?.['openai/widgetCSP']).toEqual({
      resource_domains: ['https://cdn.example.com'],
      connect_domains: ['https://api.example.com'],
    })

    const resource = _createAppResource(app, ctx)
    const read = await resource.handler(new URL('ui://mcp-app/demo'), {} as never, {} as never)
    const meta = (read.contents?.[0] as { _meta?: Record<string, unknown> })?._meta
    expect(meta?.['openai/outputTemplate']).toBe('ui://mcp-app/demo')
    expect(meta?.['openai/widgetAccessible']).toBe(true)
  })
})
