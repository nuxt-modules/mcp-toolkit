import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import type { McpHandlerOptions } from '../src/runtime/index.ts'

// Written by hand because the SDK client sends no `Origin`; only a browser does.
function ask(
  handler: { fetch: (request: Request) => Promise<Response> },
  url: string,
  origin?: string,
) {
  return handler.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { 'io.modelcontextprotocol/clientCapabilities': {} } },
      }),
    }),
  )
}

function serve(origin?: McpHandlerOptions['origin']) {
  return createMcpHandler({
    name: 'origins',
    version: '1.0.0',
    origin,
    tools: [defineMcpTool({ name: 'ping', handler: () => 'pong' })],
  })
}

describe('which browsers reach the endpoint', () => {
  it('serves a page the app serves to itself in development', async () => {
    const response = await ask(serve(), 'http://localhost:3030/mcp', 'http://localhost:3030')

    expect(response.status).toBe(200)
  })

  it('refuses a page on another origin', async () => {
    const response = await ask(serve(), 'http://localhost:3030/mcp', 'http://evil.example')

    expect(response.status).toBe(403)
  })

  it('refuses a matching origin the request itself claims', async () => {
    // The DNS rebinding shape: the attacker owns the hostname, so both headers
    // agree and a bare same-origin comparison lets it through.
    const response = await ask(serve(), 'http://evil.example/mcp', 'http://evil.example')

    expect(response.status).toBe(403)
  })

  it('serves an origin that was listed, wherever it is deployed', async () => {
    const handler = serve({ allow: ['https://app.example.com'] })

    expect(
      (await ask(handler, 'https://api.example.com/mcp', 'https://app.example.com')).status,
    ).toBe(200)
    expect(
      (await ask(handler, 'https://api.example.com/mcp', 'https://other.example')).status,
    ).toBe(403)
  })

  it('still lets a listed server keep its own pages in development', async () => {
    const handler = serve({ allow: ['https://app.example.com'] })

    expect((await ask(handler, 'http://localhost:3030/mcp', 'http://localhost:3030')).status).toBe(
      200,
    )
  })

  it('leaves clients that send no origin alone', async () => {
    expect((await ask(serve(), 'https://api.example.com/mcp')).status).toBe(200)
  })

  it('drops the check entirely on request', async () => {
    const response = await ask(serve(false), 'http://localhost:3030/mcp', 'http://evil.example')

    expect(response.status).toBe(200)
  })
})
