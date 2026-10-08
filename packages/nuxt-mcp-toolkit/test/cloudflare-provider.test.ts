import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('#nuxt-mcp-toolkit/config.mjs', () => ({ default: {} }))
vi.mock('nitropack/runtime', () => ({ useStorage: vi.fn() }))
vi.mock('cloudflare:email', () => ({ EmailMessage: vi.fn() }))
vi.mock('cloudflare:workers', () => ({
  DurableObject: vi.fn(),
  RpcTarget: vi.fn(),
  exports: {},
  tracing: undefined,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function createInitializeRequest(): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } },
    }),
  })
}

describe('Cloudflare provider', () => {
  it('answers `initialize` without the SDK v1 deprecation warning of `agents`', async () => {
    const warn = vi.spyOn(console, 'warn')
    const { handleCloudflareRequest } = await import('../src/runtime/server/mcp/providers/cloudflare')

    const response = await handleCloudflareRequest(() => new McpServer({ name: 'test', version: '1.0.0' }), createInitializeRequest())

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('"serverInfo":{"name":"test"')
    expect(warn).not.toHaveBeenCalled()
  })

  it('answers `initialize` when the server comes from another copy of the SDK', async () => {
    // A query string loads the SDK module a second time, as when `agents` resolves its own copy.
    const sdkPath = createRequire(import.meta.url).resolve('@modelcontextprotocol/sdk/server/mcp.js')
    const otherCopy: typeof import('@modelcontextprotocol/sdk/server/mcp.js') = await import(/* @vite-ignore */ `${pathToFileURL(sdkPath).href}?copy`)
    const { handleCloudflareRequest } = await import('../src/runtime/server/mcp/providers/cloudflare')

    const response = await handleCloudflareRequest(() => new otherCopy.McpServer({ name: 'test', version: '1.0.0' }), createInitializeRequest())

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('"serverInfo":{"name":"test"')
  })
})
