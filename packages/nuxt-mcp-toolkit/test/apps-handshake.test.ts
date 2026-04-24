// Smoke tests for the cross-host composables. We stub `window`/`document`
// to avoid jsdom — the bridge only needs `addEventListener` and `parent`.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
  try {
    const { __resetHostBridgeForTests } = await import('../src/runtime/app/host-bridge')
    __resetHostBridgeForTests()
  }
  catch { /* host-bridge wasn't loaded by the test */ }
  delete (globalThis as { window?: unknown }).window
  delete (globalThis as { document?: unknown }).document
  delete (globalThis as { MessageEvent?: unknown }).MessageEvent
})

function dispatch(msg: Posted): void {
  const event = new (globalThis as { MessageEvent: typeof MessageEvent }).MessageEvent('message', {
    data: msg,
    source: win.parent as unknown as MessageEventSource,
  })
  win.dispatchEvent(event)
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

    dispatch({
      jsonrpc: '2.0',
      id: init!.id,
      // @ts-expect-error: result is JSON-RPC, not in the outgoing Posted shape
      result: { hostContext: { theme: 'dark' } },
    })
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

  it('callTool round-trips structuredContent back into `data`', async () => {
    // Regression: callTool used to be fire-and-forget — filter chips never updated.
    const { useMcpApp } = await import('../src/runtime/app/use-mcp-app')
    const scope = effectScope()
    let api: ReturnType<typeof useMcpApp<{ items: number }>> | undefined
    scope.run(() => {
      api = useMcpApp<{ items: number }>()
    })

    const callPromise = api!.callTool('refilter', { type: 'Villa' })
    await flush()
    const out = win.posted.find(p => p.method === 'tools/call')
    expect(out?.params).toEqual({ name: 'refilter', arguments: { type: 'Villa' } })

    dispatch({
      jsonrpc: '2.0',
      id: out!.id,
      // @ts-expect-error: result is JSON-RPC, not in the outgoing Posted shape
      result: { structuredContent: { items: 7 } },
    })

    await callPromise
    expect(api?.data.value).toEqual({ items: 7 })
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

    expect(api?.data.value).toEqual({ hydrated: true })

    const out = await api!.callTool('refilter', { type: 'Villa' })
    expect(calls[0]).toEqual(['callTool', { name: 'refilter', args: { type: 'Villa' } }])
    expect(out).toEqual({ items: 3 })
    expect(api?.data.value).toEqual({ items: 3 })
    expect(win.posted.find(p => p.method === 'tools/call')).toBeUndefined()

    api!.sendPrompt('hello')
    expect(calls[1]).toEqual(['sendFollowUpMessage', { prompt: 'hello', scrollToBottom: true }])
    expect(win.posted.find(p => p.method === 'ui/message')).toBeUndefined()

    api!.openLink('https://example.com/path')
    expect(calls[2]).toEqual(['openExternal', { href: 'https://example.com/path' }])
    expect(win.posted.find(p => p.method === 'ui/open-link')).toBeUndefined()

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

  it('useToolCall(name) returns a bound `call(args)`', async () => {
    const { useToolCall } = await import('../src/runtime/app/use-tool-call')
    const scope = effectScope()
    let tool: ReturnType<typeof useToolCall<{ items: number }>> | undefined
    scope.run(() => {
      tool = useToolCall<{ items: number }>('refilter')
    })

    const promise = tool!.call({ type: 'Villa' })
    expect(tool!.pending.value).toBe(true)
    await flush()
    const out = win.posted.find(p => p.method === 'tools/call')
    expect(out?.params).toEqual({ name: 'refilter', arguments: { type: 'Villa' } })

    dispatch({
      jsonrpc: '2.0',
      id: out!.id,
      // @ts-expect-error: JSON-RPC reply, not an outgoing message
      result: { structuredContent: { items: 5 } },
    })

    expect(await promise).toEqual({ items: 5 })
    expect(tool!.result.value).toEqual({ items: 5 })
    expect(tool!.pending.value).toBe(false)
    scope.stop()
  })
})
