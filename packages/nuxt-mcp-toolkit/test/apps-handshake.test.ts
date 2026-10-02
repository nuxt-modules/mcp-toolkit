// Smoke tests for the cross-host composables. We stub `window`/`document`
// to avoid jsdom — the bridge only needs `addEventListener` and `parent`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

interface Posted {
  jsonrpc?: string
  id?: string | number
  method?: string
  params?: Record<string, unknown>
  type?: string
  payload?: unknown
  messageId?: string
}

interface JsonRpcReply {
  jsonrpc: '2.0'
  id?: string | number
  result?: unknown
  error?: { code: number, message: string, data?: unknown }
}

interface FakeWindow extends EventTarget {
  parent: { postMessage: (msg: Posted) => void }
  posted: Posted[]
  openai?: object
}

let win: FakeWindow

/** Yield to the bridge's deferred handshake (it awaits one microtask). */
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

beforeEach(() => {
  const target = new EventTarget() as FakeWindow
  target.posted = []
  target.parent = { postMessage: (msg: Posted) => target.posted.push(msg) }
  win = target
  ;(globalThis as unknown as { window: FakeWindow }).window = win
  ;(globalThis as unknown as { document: { getElementById: () => null, readyState: string } }).document = {
    getElementById: () => null,
    readyState: 'complete',
  }
  ;(globalThis as unknown as { MessageEvent: typeof MessageEvent }).MessageEvent = class extends Event {
    data: unknown
    source: unknown
    origin: string
    constructor(type: string, init: { data?: unknown, source?: unknown, origin?: string } = {}) {
      super(type)
      this.data = init.data
      this.source = init.source
      this.origin = init.origin ?? ''
    }
  } as unknown as typeof MessageEvent
})

afterEach(async () => {
  vi.useRealTimers()
  try {
    const { __resetHostBridgeForTests } = await import('../src/runtime/app/host-bridge')
    __resetHostBridgeForTests()
  }
  catch { /* host-bridge wasn't loaded by the test */ }
  delete (globalThis as { window?: unknown }).window
  delete (globalThis as { document?: unknown }).document
  delete (globalThis as { MessageEvent?: unknown }).MessageEvent
})

function dispatch(msg: Posted | JsonRpcReply): void {
  const event = new (globalThis as { MessageEvent: typeof MessageEvent }).MessageEvent('message', {
    data: msg,
    source: win.parent as unknown as MessageEventSource,
  })
  win.dispatchEvent(event)
}

/** Answer the last request the view posted for `method`. */
function reply(method: string, body: Pick<JsonRpcReply, 'result' | 'error'>): void {
  const request = win.posted.findLast(p => p.method === method)
  expect(request?.id).toBeDefined()
  dispatch({ jsonrpc: '2.0', id: request!.id, ...body })
}

async function completeHandshake(result: Record<string, unknown> = {}): Promise<void> {
  await flush()
  reply('ui/initialize', { result })
  await flush()
}

async function mountApp() {
  const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
  const scope = effectScope()
  const api = scope.run(() => useMcpApp())!
  return { api, scope }
}

describe('useMcpApp (host bridge)', () => {
  it('emits `ui-lifecycle-iframe-ready` before any other message', async () => {
    // Cursor-class hosts won't subscribe until they see this signal.
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    scope.run(() => useMcpApp())

    const ready = win.posted.find(p => p.type === 'ui-lifecycle-iframe-ready')
    expect(ready).toBeDefined()
    const readyIdx = win.posted.indexOf(ready!)
    const initIdx = win.posted.findIndex(p => p.method === 'ui/initialize')
    expect(readyIdx).toBeLessThan(initIdx === -1 ? Infinity : initIdx)
    scope.stop()
  })

  it('runs the spec-compliant handshake (initialize → wait → initialized)', async () => {
    // Regression: ChatGPT silently drops handshakes with the wrong shape.
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })

    await flush()

    const init = win.posted.find(p => p.method === 'ui/initialize')
    expect(init?.params).toMatchObject({
      protocolVersion: '2026-01-26',
      appInfo: { name: expect.any(String), version: expect.any(String) },
      appCapabilities: { availableDisplayModes: expect.arrayContaining(['inline']) },
    })
    expect(win.posted.find(p => p.method === 'ui/notifications/initialized')).toBeUndefined()

    reply('ui/initialize', { result: { hostContext: { theme: 'dark' } } })
    await flush()

    expect(api?.hostContext.value).toEqual({ theme: 'dark' })
    expect(win.posted.find(p => p.method === 'ui/notifications/initialized')).toBeDefined()
    scope.stop()
  })

  it('updates `data` and clears `loading` when the host pushes tool-result', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp<{ total: number }>> | undefined
    scope.run(() => {
      api = useMcpApp<{ total: number }>()
    })

    expect(api?.loading.value).toBe(true)

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { total: 12 } },
    })

    expect(api?.data.value).toEqual({ total: 12 })
    expect(api?.loading.value).toBe(false)
    scope.stop()
  })

  it('sets `error` and clears `loading` when the host pushes an error result', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { isError: true, content: [{ type: 'text', text: 'Quota exceeded' }] },
    })

    expect(api?.data.value).toBeNull()
    expect(api?.loading.value).toBe(false)
    expect(api?.error.value?.message).toBe('Quota exceeded')
    scope.stop()
  })

  it('sets `error` and clears `loading` when the host cancels the tool call', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-cancelled',
      params: { reason: 'user stopped the response' },
    })

    expect(api?.loading.value).toBe(false)
    expect(api?.error.value?.message).toBe('useMcpApp: the tool call was cancelled: user stopped the response')

    let late: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      late = useMcpApp()
    })
    expect(late?.loading.value).toBe(false)
    scope.stop()
  })

  it('callTool round-trips structuredContent back into `data`', async () => {
    // Regression: callTool used to be fire-and-forget — filter chips never updated.
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp<{ items: number }>> | undefined
    scope.run(() => {
      api = useMcpApp<{ items: number }>()
    })

    const callPromise = api!.callTool('refilter', { type: 'Villa' })
    await completeHandshake()
    const out = win.posted.find(p => p.method === 'tools/call')
    expect(out?.params).toEqual({ name: 'refilter', arguments: { type: 'Villa' } })

    reply('tools/call', { result: { structuredContent: { items: 7 } } })

    await callPromise
    expect(api?.data.value).toEqual({ items: 7 })
    scope.stop()
  })

  it('clears `loading` when callTool resolves before any tool-result', async () => {
    const { api, scope } = await mountApp()
    expect(api.loading.value).toBe(true)

    const callPromise = api.callTool('list_todos')
    await completeHandshake()
    reply('tools/call', { result: { structuredContent: { total: 3 } } })
    await callPromise

    expect(api.data.value).toEqual({ total: 3 })
    expect(api.initialData.value).toBeNull()
    expect(api.loading.value).toBe(false)
    scope.stop()
  })

  it('sets `error` and clears `loading` when callTool fails before any tool-result', async () => {
    const { api, scope } = await mountApp()

    const callPromise = api.callTool('list_todos')
    await completeHandshake()
    reply('tools/call', { result: { isError: true, content: [{ type: 'text', text: 'Database offline' }] } })
    await callPromise

    expect(api.error.value?.message).toBe('Database offline')
    expect(api.loading.value).toBe(false)
    scope.stop()
  })

  it('keeps the result of a callTool that resolves after another callTool failed', async () => {
    const { api, scope } = await mountApp()

    const firstCall = api.callTool('list_todos')
    const secondCall = api.callTool('list_todos')
    await completeHandshake()
    const [firstRequest, secondRequest] = win.posted.filter(p => p.method === 'tools/call')
    dispatch({ jsonrpc: '2.0', id: secondRequest!.id, result: { isError: true, content: [{ type: 'text', text: 'Database offline' }] } })
    await secondCall
    dispatch({ jsonrpc: '2.0', id: firstRequest!.id, result: { structuredContent: { total: 3 } } })
    await firstCall

    expect(api.data.value).toEqual({ total: 3 })
    scope.stop()
  })

  it('routes callTool / sendPrompt / openLink through window.openai when ChatGPT injects it', async () => {
    // ChatGPT silently drops postMessage from inner iframes — must route through `window.openai.*`.
    const calls: Array<['callTool' | 'sendFollowUpMessage' | 'openExternal', unknown]> = []
    win.openai = {
      toolOutput: { hydrated: true },
      callTool: async (name: string, args: Record<string, unknown>) => {
        calls.push(['callTool', { name, args }])
        return { structuredContent: { items: 3 } }
      },
      sendFollowUpMessage: (params: { prompt: string, scrollToBottom?: boolean }) =>
        calls.push(['sendFollowUpMessage', params]),
      openExternal: (params: { href: string }) => calls.push(['openExternal', params]),
    }

    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp<{ items?: number, hydrated?: boolean }>> | undefined
    scope.run(() => {
      api = useMcpApp<{ items?: number, hydrated?: boolean }>()
    })

    expect(api?.initialData.value).toEqual({ hydrated: true })
    expect(api?.data.value).toEqual({ hydrated: true })

    const out = await api!.callTool('refilter', { type: 'Villa' })
    expect(calls[0]).toEqual(['callTool', { name: 'refilter', args: { type: 'Villa' } }])
    expect(out).toEqual({ items: 3 })
    expect(api?.data.value).toEqual({ items: 3 })
    expect(api?.initialData.value).toEqual({ hydrated: true })
    expect(win.posted.find(p => p.method === 'tools/call')).toBeUndefined()

    api!.sendPrompt('hello')
    expect(calls[1]).toEqual(['sendFollowUpMessage', { prompt: 'hello', scrollToBottom: true }])
    expect(win.posted.find(p => p.method === 'ui/message')).toBeUndefined()

    api!.openLink('https://example.com/path')
    expect(calls[2]).toEqual(['openExternal', { href: 'https://example.com/path' }])
    expect(win.posted.find(p => p.method === 'ui/open-link')).toBeUndefined()

    scope.stop()
  })

  it('hands the latest tool result to a `useMcpApp()` call made after the push', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    scope.run(() => useMcpApp())
    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { listId: 'abc-123' } },
    })

    let late: ReturnType<typeof useMcpApp<{ listId: string }>> | undefined
    scope.run(() => {
      late = useMcpApp<{ listId: string }>()
    })
    expect(late?.data.value).toEqual({ listId: 'abc-123' })
    expect(late?.loading.value).toBe(false)
    scope.stop()
  })

  it('exposes the tool result `_meta` as `meta`, refreshed by tool-result and callTool', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })

    expect(api?.meta.value).toBeNull()
    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { total: 1 }, _meta: { svg: '<svg/>' } },
    })
    expect(api?.meta.value).toEqual({ svg: '<svg/>' })

    let late: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      late = useMcpApp()
    })
    expect(late?.meta.value).toEqual({ svg: '<svg/>' })

    const callPromise = api!.callTool('refresh')
    await completeHandshake()
    reply('tools/call', { result: { structuredContent: { total: 2 }, _meta: { svg: '<svg id="2"/>' } } })
    await callPromise
    expect(api?.meta.value).toEqual({ svg: '<svg id="2"/>' })

    const secondCall = api!.callTool('refresh')
    await flush()
    reply('tools/call', { result: { structuredContent: { total: 3 } } })
    await secondCall
    expect(api?.meta.value).toBeNull()

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { total: 4 }, _meta: { svg: '<svg id="4"/>' } },
    })
    expect(api?.meta.value).toEqual({ svg: '<svg id="4"/>' })

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { total: 5 }, _meta: 'not an object' },
    })
    expect(api?.meta.value).toBeNull()
    scope.stop()
  })

  it('reads `meta` from `window.openai.toolResponseMetadata` on ChatGPT', async () => {
    const openai = {
      toolOutput: { total: 1 },
      toolResponseMetadata: { svg: '<svg/>' },
      callTool: async () => ({ structuredContent: { total: 4 } }),
    }
    win.openai = openai

    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })
    expect(api?.meta.value).toEqual({ svg: '<svg/>' })

    // `openai:set_globals` carries only the globals that changed.
    openai.toolOutput = { total: 2 }
    openai.toolResponseMetadata = { svg: '<svg id="2"/>' }
    win.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: openai.toolOutput } } }))
    expect(api?.data.value).toEqual({ total: 2 })
    expect(api?.meta.value).toEqual({ svg: '<svg id="2"/>' })

    openai.toolResponseMetadata = { svg: '<svg id="3"/>' }
    win.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolResponseMetadata: openai.toolResponseMetadata } } }))
    expect(api?.data.value).toEqual({ total: 2 })
    expect(api?.meta.value).toEqual({ svg: '<svg id="3"/>' })

    // An event for another global must not replace the `callTool` result with `window.openai.toolOutput`.
    await api?.callTool('refresh')
    win.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { theme: 'dark' } } }))
    expect(api?.data.value).toEqual({ total: 4 })
    expect(api?.meta.value).toBeNull()
    scope.stop()
  })

  it('unwraps `_meta` when ChatGPT passes `toolResponseMetadata` as the MCP result envelope', async () => {
    win.openai = {
      toolOutput: { total: 1 },
      toolResponseMetadata: { status: 'success', mcp_tool_result: { structuredContent: { total: 1 }, _meta: { svg: '<svg/>' } } },
    }

    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    const api = scope.run(() => useMcpApp())!
    expect(api.meta.value).toEqual({ svg: '<svg/>' })
    scope.stop()
  })

  it('keeps `initialData` at the first payload when `data` is refreshed by callTool or tool-result', async () => {
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp<{ listId: string, total?: number }>> | undefined
    scope.run(() => {
      api = useMcpApp<{ listId: string, total?: number }>()
    })

    expect(api?.initialData.value).toBeNull()
    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { listId: 'abc-123' } },
    })
    expect(api?.initialData.value).toEqual({ listId: 'abc-123' })
    expect(api?.data.value).toEqual({ listId: 'abc-123' })

    dispatch({
      jsonrpc: '2.0',
      method: 'ui/notifications/tool-result',
      params: { structuredContent: { total: 2 } },
    })
    expect(api?.data.value).toEqual({ total: 2 })
    expect(api?.initialData.value).toEqual({ listId: 'abc-123' })

    const callPromise = api!.callTool('list_todos', { listId: 'abc-123' })
    await completeHandshake()
    reply('tools/call', { result: { structuredContent: { total: 5 } } })
    await callPromise

    expect(api?.data.value).toEqual({ total: 5 })
    expect(api?.initialData.value).toEqual({ listId: 'abc-123' })
    scope.stop()
  })

  it('dual-emits sendPrompt / openLink in the spec + mcp-ui legacy formats when window.openai is absent', async () => {
    // Regression: spec hosts (Cursor) require ui/message + ui/open-link as REQUESTS (with id), not notifications.
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp> | undefined
    scope.run(() => {
      api = useMcpApp()
    })

    api!.sendPrompt('hello there')
    const msg = win.posted.find(p => p.method === 'ui/message')
    expect(msg?.id).toBeDefined()
    expect(msg?.params).toEqual({
      role: 'user',
      content: [{ type: 'text', text: 'hello there' }],
    })
    expect(win.posted.find(p => p.type === 'prompt')?.payload).toEqual({
      prompt: 'hello there',
    })

    api!.openLink('https://example.com/path')
    const link = win.posted.find(p => p.method === 'ui/open-link')
    expect(link?.id).toBeDefined()
    expect(link?.params).toEqual({
      url: 'https://example.com/path',
    })
    expect(win.posted.find(p => p.type === 'link')?.payload).toEqual({
      url: 'https://example.com/path',
    })

    scope.stop()
  })

  it('emits ui/notifications/size-changed so hosts can shrink the iframe', async () => {
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = (cb: FrameRequestCallback) => {
      setTimeout(() => cb(performance.now()), 0)
      return 0
    }
    Object.defineProperty(globalThis.document, 'documentElement', {
      configurable: true,
      get: () => ({ scrollWidth: 480, scrollHeight: 320 } as HTMLElement),
    })
    Object.defineProperty(globalThis.document, 'body', {
      configurable: true,
      get: () => ({ scrollWidth: 480, scrollHeight: 320 } as HTMLElement),
    })

    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    scope.run(() => useMcpApp())
    await flush()

    const size = win.posted.find(p => p.method === 'ui/notifications/size-changed')
    expect(size?.params).toEqual({ width: 480, height: 320 })

    scope.stop()
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    delete (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame
  })
})

describe('internal composables', () => {
  it('useFollowUp / useExternalLink / useToolCall share the singleton bridge', async () => {
    const { useFollowUp } = await import('../src/runtime/app/use-follow-up')
    const { useExternalLink } = await import('../src/runtime/app/use-external-link')
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')

    const scope = effectScope()
    scope.run(() => {
      useFollowUp()
      useExternalLink()
      useToolCall<{ items: number }>('refilter')
    })

    await flush()

    const initCount = win.posted.filter(p => p.method === 'ui/initialize').length
    expect(initCount).toBe(1)

    scope.stop()
  })

  it('useFollowUp dual-emits without window.openai', async () => {
    const { useFollowUp } = await import('../src/runtime/app/use-follow-up')
    const scope = effectScope()
    let send: ReturnType<typeof useFollowUp> | undefined
    scope.run(() => {
      send = useFollowUp()
    })

    send!('Open the checkout')
    expect(win.posted.find(p => p.method === 'ui/message')).toBeDefined()
    expect(win.posted.find(p => p.type === 'prompt')).toBeDefined()
    scope.stop()
  })

  it('useToolCall exposes the `_meta` of a `window.openai.callTool` result as `meta`', async () => {
    const results = [
      { structuredContent: { png: 'base64' }, _meta: { 'my-app/size': 512 } },
      { structuredContent: { png: 'base64' }, _meta: ['not', 'an', 'object'] },
    ]
    win.openai = { callTool: async () => results.shift() }
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')
    const scope = effectScope()
    const tool = scope.run(() => useToolCall('get_icon_png'))!

    await tool.call({ iconId: 'a' })
    expect(tool.result.value).toEqual({ png: 'base64' })
    expect(tool.meta.value).toEqual({ 'my-app/size': 512 })

    await tool.call({ iconId: 'b' })
    expect(tool.meta.value).toBeNull()
    scope.stop()
  })

  it('useToolCall(name) returns a bound `call(args)`', async () => {
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')
    const scope = effectScope()
    let tool: ReturnType<typeof useToolCall<{ items: number }>> | undefined
    scope.run(() => {
      tool = useToolCall<{ items: number }>('refilter')
    })

    const promise = tool!.call({ type: 'Villa' })
    expect(tool!.pending.value).toBe(true)
    await completeHandshake()
    const out = win.posted.find(p => p.method === 'tools/call')
    expect(out?.params).toEqual({ name: 'refilter', arguments: { type: 'Villa' } })

    reply('tools/call', { result: { structuredContent: { items: 5 } } })

    expect(await promise).toEqual({ items: 5 })
    expect(tool!.result.value).toEqual({ items: 5 })
    expect(tool!.pending.value).toBe(false)
    scope.stop()
  })

  it('useToolCall holds `tools/call` until the handshake settles', async () => {
    // Regression: a tool called on mount raced `ui/initialize` and the host dropped it.
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')
    const scope = effectScope()
    const tool = scope.run(() => useToolCall('refilter'))!

    tool.call({})
    await flush()
    expect(win.posted.find(p => p.method === 'tools/call')).toBeUndefined()

    await completeHandshake()
    expect(win.posted.find(p => p.method === 'tools/call')).toBeDefined()
    scope.stop()
  })

  it.each([
    ['its text', [{ type: 'text', text: 'Icon not found' }], 'Icon not found'],
    ['a fallback without text', [], 'useToolCall: the "get_icon_png" tool call failed.'],
  ])('useToolCall sets `error` to %s when the tool result reports `isError`', async (_, content, message) => {
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')
    const scope = effectScope()
    const tool = scope.run(() => useToolCall('get_icon_png'))!

    const promise = tool.call({ iconId: 'missing' })
    await completeHandshake()
    reply('tools/call', { result: { isError: true, structuredContent: { iconId: 'missing' }, content } })

    expect(await promise).toBeNull()
    expect(tool.error.value?.message).toBe(message)
    expect(tool.result.value).toBeNull()
    scope.stop()
  })
})

describe('useMcpApp (host requests)', () => {
  it('exposes the capabilities the host announced in `ui/initialize`', async () => {
    const { api, scope } = await mountApp()
    expect(api.hostCapabilities.value).toBeNull()

    await completeHandshake({ hostCapabilities: { openLinks: {}, downloadFile: {} } })
    expect(api.hostCapabilities.value).toEqual({ openLinks: {}, downloadFile: {} })
    scope.stop()
  })

  it('merges partial `host-context-changed` updates into `hostContext`', async () => {
    const { api, scope } = await mountApp()
    await completeHandshake({ hostContext: { theme: 'light', displayMode: 'inline' } })

    dispatch({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } })
    dispatch({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { displayMode: 'fullscreen' } })
    expect(api.hostContext.value).toEqual({ theme: 'dark', displayMode: 'fullscreen' })

    const before = api.hostContext.value
    dispatch({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } })
    expect(api.hostContext.value).toBe(before)
    scope.stop()
  })

  it('requestDisplayMode waits for the handshake and resolves with the mode the host set', async () => {
    const { api, scope } = await mountApp()
    const promise = api.requestDisplayMode('pip')
    await flush()
    expect(win.posted.find(p => p.method === 'ui/request-display-mode')).toBeUndefined()

    await completeHandshake({ hostContext: { displayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen', 'pip'] } })
    expect(win.posted.find(p => p.method === 'ui/request-display-mode')?.params).toEqual({ mode: 'pip' })
    // claude.ai answers `pip` with `inline`.
    reply('ui/request-display-mode', { result: { mode: 'inline' } })
    await expect(promise).resolves.toBe('inline')

    const fullscreen = api.requestDisplayMode('fullscreen')
    await flush()
    reply('ui/request-display-mode', { result: { mode: 'fullscreen' } })
    await expect(fullscreen).resolves.toBe('fullscreen')
    expect(api.hostContext.value?.displayMode).toBe('fullscreen')
    scope.stop()
  })

  it('requestDisplayMode does not ask for a mode the host does not offer', async () => {
    const { api, scope } = await mountApp()
    await completeHandshake({ hostContext: { displayMode: 'inline', availableDisplayModes: ['inline'] } })

    await expect(api.requestDisplayMode('fullscreen')).resolves.toBe('inline')
    expect(win.posted.find(p => p.method === 'ui/request-display-mode')).toBeUndefined()
    scope.stop()
  })

  it('requestDisplayMode routes through window.openai when ChatGPT injects it', async () => {
    const requested: unknown[] = []
    win.openai = {
      requestDisplayMode: async (params: { mode: string }) => {
        requested.push(params)
        return { mode: 'fullscreen' }
      },
    }

    const { api, scope } = await mountApp()
    await expect(api.requestDisplayMode('fullscreen')).resolves.toBe('fullscreen')
    expect(requested).toEqual([{ mode: 'fullscreen' }])
    expect(api.hostContext.value?.displayMode).toBe('fullscreen')
    expect(win.posted.find(p => p.method === 'ui/request-display-mode')).toBeUndefined()
    scope.stop()
  })

  it('updateModelContext sends content and structuredContent, and rejects with the JSON-RPC error code', async () => {
    const { api, scope } = await mountApp()
    await completeHandshake({ hostCapabilities: { updateModelContext: { text: {} } } })

    const update = api.updateModelContext({ structuredContent: { selected: 'b' } })
    await flush()
    expect(win.posted.find(p => p.method === 'ui/update-model-context')?.params).toEqual({
      content: [],
      structuredContent: { selected: 'b' },
    })
    reply('ui/update-model-context', { result: {} })
    await expect(update).resolves.toBeUndefined()

    const withoutContent = api.updateModelContext({ content: undefined })
    await flush()
    expect(win.posted.findLast(p => p.method === 'ui/update-model-context')?.params).toEqual({ content: [] })
    reply('ui/update-model-context', { result: {} })
    await withoutContent

    const failing = api.updateModelContext({ content: [{ type: 'text', text: 'b' }] })
    await flush()
    reply('ui/update-model-context', { error: { code: -32602, message: 'Invalid params', data: { field: 'content' } } })
    await expect(failing).rejects.toMatchObject({ message: 'Invalid params', code: -32602, data: { field: 'content' } })
    scope.stop()
  })

  it('downloadFile resolves when the host saved the file and rejects when it was cancelled', async () => {
    const { api, scope } = await mountApp()
    await completeHandshake({ hostCapabilities: { downloadFile: {} } })
    const file = { type: 'resource' as const, resource: { uri: 'file:///palette.json', mimeType: 'application/json', text: '{}' } }

    const saved = api.downloadFile([file])
    await flush()
    expect(win.posted.find(p => p.method === 'ui/download-file')?.params).toEqual({ contents: [file] })
    reply('ui/download-file', { result: {} })
    await expect(saved).resolves.toBeUndefined()

    const cancelled = api.downloadFile([file])
    await flush()
    reply('ui/download-file', { result: { isError: true } })
    await expect(cancelled).rejects.toMatchObject({ cancelled: true })
    scope.stop()
  })

  it('downloadFile rejects without asking when the host lacks the capability', async () => {
    // Claude iOS announces no `downloadFile`.
    const { api, scope } = await mountApp()
    await completeHandshake({ hostCapabilities: {} })

    await expect(api.downloadFile([])).rejects.toMatchObject({ code: -32601 })
    expect(win.posted.find(p => p.method === 'ui/download-file')).toBeUndefined()
    scope.stop()
  })

  it('downloadFile only hands the host http(s) links to fetch', async () => {
    const { api, scope } = await mountApp()
    await completeHandshake({ hostCapabilities: { downloadFile: {} } })

    for (const uri of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/plain,hi', 'not a url']) {
      await expect(api.downloadFile([{ type: 'resource_link', uri, name: 'file' }])).rejects.toMatchObject({ code: -32602 })
    }
    expect(win.posted.find(p => p.method === 'ui/download-file')).toBeUndefined()
    scope.stop()
  })

  it('rejects host requests when there is no host window', async () => {
    delete (win as { parent?: unknown }).parent
    const { api, scope } = await mountApp()

    await expect(api.requestDisplayMode('fullscreen')).rejects.toThrow('there is no host window')
    await expect(api.downloadFile([])).rejects.toThrow('there is no host window')
    scope.stop()
  })

  it('rejects host requests immediately once the handshake timed out', async () => {
    vi.useFakeTimers()
    const { api, scope } = await mountApp()
    await vi.advanceTimersByTimeAsync(5_000)
    const posted = win.posted.length

    await expect(api.requestDisplayMode('fullscreen')).rejects.toThrow('handshake did not complete')
    await expect(api.updateModelContext({})).rejects.toThrow('handshake did not complete')
    await expect(api.downloadFile([])).rejects.toThrow('handshake did not complete')
    expect(win.posted).toHaveLength(posted)
    scope.stop()
  })
})
