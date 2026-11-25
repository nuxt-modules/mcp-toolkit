import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { setup, url, getServerLogs } from '@nuxt/test-utils/e2e'
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'
import { MODERN_PROTOCOL_VERSION } from 'nitro-mcp-toolkit'

describe('Nuxt with the shared Nitro engine', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/shared-engine', import.meta.url)),
  })

  const handler = { fetch: (request: Request) => fetch(request) }

  it.each(['modern', 'legacy'] as const)('serves %s clients with request context and typed output', async (era) => {
    await using client = await createMcpTestClient(handler, { era, url: url('/mcp') })
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['greet', 'inherited', 'slow'])
    const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })
    expect(result.structuredContent).toEqual({ greeting: 'Hello Ada from demo-user', era })
    expect(textOf(await client.callTool({ name: 'inherited' }))).toBe('from the layer')
    expect(textOf(await client.readResource({ uri: 'docs://readme' }))).toBe('shared engine resource')
    expect(textOf(await client.getPrompt({ name: 'review' }))).toBe('Review this change.')
  })

  it('keeps the protected server on its own definitions', async () => {
    await expect(createMcpTestClient(handler, { url: url('/admin/mcp') })).rejects.toThrow(/401/)
    await using client = await createMcpTestClient(handler, {
      url: url('/admin/mcp'),
      headers: { authorization: 'Bearer demo-token' },
    })
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['purge'])
    expect(textOf(await client.callTool({ name: 'purge' }))).toBe('purged')
  })

  it.each(['modern', 'legacy'] as const)('supports a composed Nuxt route for %s clients', async (era) => {
    await using client = await createMcpTestClient(handler, { era, url: url('/composed') })
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['manual', 'slow'])
    expect(JSON.parse(textOf(await client.callTool({ name: 'manual' })))).toEqual({ user: 'demo-user', era, sameContext: true })
  })

  it('keeps concurrent users in separate request contexts', async () => {
    const results = await Promise.all(['Ada', 'Grace'].map(async (user) => {
      await using client = await createMcpTestClient(handler, {
        url: url('/composed'), headers: { 'x-test-user': user },
      })
      return JSON.parse(textOf(await client.callTool({ name: 'manual' })))
    }))
    expect(results).toEqual([
      { user: 'Ada', era: 'modern', sameContext: true },
      { user: 'Grace', era: 'modern', sameContext: true },
    ])
  })

  it('accepts a modern request without initialization and returns cache hints', async () => {
    const response = await fetch(url('/mcp'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'accept': 'application/json, text/event-stream',
        'mcp-protocol-version': MODERN_PROTOCOL_VERSION, 'mcp-method': 'tools/list',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 42, method: 'tools/list', params: { _meta: {
          'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {},
        } },
      }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('mcp-session-id')).toBeNull()
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0', id: 42,
      result: { resultType: 'complete', ttlMs: expect.any(Number), cacheScope: expect.stringMatching(/^(public|private)$/) },
    })
  })

  it.each(['2025-03-26', '2025-06-18', '2025-11-25'])('negotiates legacy revision %s', async (protocolVersion) => {
    const response = await fetch(url('/mcp'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'mcp-protocol-version': protocolVersion },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion, capabilities: {}, clientInfo: { name: 'legacy-nuxt-fixture', version: '1.0.0' } },
      }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ result: { protocolVersion } })
  })

  it('checks authorization on each request after a client has connected', async () => {
    await using client = await createMcpTestClient(handler, {
      url: url('/admin/mcp'), headers: { authorization: 'Bearer demo-token' },
    })
    expect(textOf(await client.callTool({ name: 'purge' }))).toBe('purged')
    const response = await fetch(url('/admin/mcp'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json', 'accept': 'application/json, text/event-stream',
        'authorization': 'Bearer revoked-token',
        'mcp-protocol-version': MODERN_PROTOCOL_VERSION, 'mcp-method': 'tools/call', 'mcp-name': 'purge',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 43, method: 'tools/call', params: { name: 'purge', _meta: {
          'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {},
        } },
      }),
    })
    expect(response.status).toBe(401)
    await response.body?.cancel()
  })

  it('exposes the generated catalog through the shared public server import', async () => {
    expect(await fetch(url('/api/catalog')).then(response => response.json())).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'tool', name: 'greet', file: 'tools/greet.ts' }),
      expect.objectContaining({ kind: 'resource', name: 'readme', uri: 'docs://readme' }),
    ]))
  })

  it('preserves middleware headers and accepts the client tool allowlist', async () => {
    const response = await fetch(url('/mcp'))
    expect(response.headers.get('x-middleware')).toBe('preserved')
    await response.body?.cancel()
    await using client = await createMcpTestClient(handler, {
      url: url('/mcp'), headers: { 'x-mcp-tools': 'greet' },
    })
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['greet'])
  })

  it('delivers list-change notifications over a persistent stream', async () => {
    await using client = await createMcpTestClient(handler, { url: url('/mcp') })
    const changed = vi.fn()
    client.setNotificationHandler('notifications/tools/list_changed', changed)
    const subscription = await client.listen({ toolsListChanged: true })
    await fetch(url('/api/notify'), { method: 'POST' })
    await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce())
    await subscription.close()
  })

  it.each(['/mcp', '/composed'])('cancels a running invocation when its HTTP stream disconnects at %s', async (endpoint) => {
    const before = await fetch(url('/api/signals')).then(result => result.json())
    const controller = new AbortController()
    const response = await fetch(url(endpoint), {
      method: 'POST', signal: controller.signal,
      headers: {
        'content-type': 'application/json', 'accept': 'application/json, text/event-stream',
        'mcp-protocol-version': MODERN_PROTOCOL_VERSION, 'mcp-method': 'tools/call', 'mcp-name': 'slow',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: { name: 'slow', _meta: {
          'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
          'io.modelcontextprotocol/clientCapabilities': {}, 'progressToken': 'cancel-test',
        } },
      }),
    })
    expect(response.status, JSON.stringify(getServerLogs())).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    controller.abort()
    await vi.waitFor(async () => {
      const signals = await fetch(url('/api/signals')).then(result => result.json())
      expect(signals).toEqual({ started: before.started + 1, aborted: before.aborted + 1 })
    })
  })
})
