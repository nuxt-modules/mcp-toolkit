import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpHandlerOptions } from '../src/runtime/index.ts'

// MCP clients proper send no `Origin`, so these tests forge one by hand — the
// SDK client used everywhere else in this suite never would.
function withOrigin(
  origin: string | undefined,
  handlerOptions: McpHandlerOptions = {},
  url?: string,
) {
  const handler = createMcpHandler({
    tools: [defineMcpTool({ name: 'ping', handler: () => 'pong' })],
    ...handlerOptions,
  })

  return createMcpTestClient(
    {
      fetch: (request) => {
        const headers = new Headers(request.headers)
        if (origin) headers.set('origin', origin)
        return handler.fetch(new Request(request, { headers }))
      },
    },
    { url },
  )
}

describe('which browsers reach the endpoint', () => {
  it('serves a page the app serves to itself in development', async () => {
    await using client = await withOrigin('http://localhost')

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('refuses a page on another origin', async () => {
    await expect(withOrigin('https://evil.example')).rejects.toThrow()
  })

  it('refuses a matching origin the request itself claims', async () => {
    // The DNS rebinding shape: the attacker owns the hostname, so both headers
    // agree and a bare same-origin comparison lets it through.
    await expect(withOrigin('http://evil.example', {}, 'http://evil.example/mcp')).rejects.toThrow()
  })

  it('serves an origin that was listed, wherever it is deployed', async () => {
    const options = { origin: { allow: ['https://app.example.com'] } }
    const url = 'https://api.example.com/mcp'

    await using client = await withOrigin('https://app.example.com', options, url)
    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()

    await expect(withOrigin('https://other.example', options, url)).rejects.toThrow()
  })

  it('still lets a listed server keep its own pages in development', async () => {
    await using client = await withOrigin('http://localhost', {
      origin: { allow: ['https://app.example.com'] },
    })

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('leaves clients that send no origin alone', async () => {
    await using client = await withOrigin(undefined, {}, 'https://api.example.com/mcp')

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('drops the check entirely on request', async () => {
    await using client = await withOrigin('https://evil.example', { origin: false })

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })
})
