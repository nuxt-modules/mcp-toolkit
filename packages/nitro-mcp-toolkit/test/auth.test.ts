import { describe, expect, it } from 'vitest'
import { createMcpHandler, defineMcpTool } from '../src/runtime/index.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpAuthOptions } from '../src/runtime/index.ts'

/** A request the handler sees directly, bypassing the SDK client. */
function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  })
}

/** A real SDK client, so the happy path is proven end to end, not just per-response. */
function withHeader(auth: McpAuthOptions, header?: string, value?: string) {
  const handler = createMcpHandler({
    auth,
    tools: [defineMcpTool({ name: 'ping', handler: () => 'pong' })],
  })

  return createMcpTestClient({
    fetch: (req, options) => {
      const headers = new Headers(req.headers)
      if (header && value) headers.set(header, value)
      return handler.fetch(new Request(req, { headers }), options)
    },
  })
}

describe('auth config', () => {
  it('throws building a handler with neither tokens nor validate', () => {
    expect(() => createMcpHandler({ auth: {} })).toThrow(
      /needs at least one of `tokens` or `validate`/,
    )
  })

  it('throws on an invalid header name', () => {
    expect(() => createMcpHandler({ auth: { tokens: ['x'], header: 'not a header' } })).toThrow(
      /not a valid header name/,
    )
  })

  it('throws when resourceMetadataUrl excludes the bearer scheme', () => {
    expect(() =>
      createMcpHandler({
        auth: {
          tokens: ['x'],
          schemes: ['api-key'],
          resourceMetadataUrl: 'https://example.com/meta',
        },
      }),
    ).toThrow(/needs the `bearer` scheme/)
  })

  it('throws on a resourceMetadataUrl that is not absolute', () => {
    expect(() =>
      createMcpHandler({ auth: { tokens: ['x'], resourceMetadataUrl: '/meta' } }),
    ).toThrow()
  })
})

describe('a bearer/api-key gate', () => {
  it('refuses a request with no credential', async () => {
    const handler = createMcpHandler({ auth: { tokens: ['secret'] } })
    const response = await handler.fetch(request())

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="mcp"')
  })

  it('refuses a bearer token that is not on the list', async () => {
    const handler = createMcpHandler({ auth: { tokens: ['secret'] } })
    const response = await handler.fetch(request({ authorization: 'Bearer wrong' }))

    expect(response.status).toBe(401)
  })

  it('carries no JSON-RPC body on a refusal', async () => {
    const handler = createMcpHandler({ auth: { tokens: ['secret'] } })
    const response = await handler.fetch(request())
    const text = await response.text()

    expect(() => JSON.parse(text)).toThrow()
  })

  it('accepts a listed bearer token', async () => {
    await using client = await withHeader({ tokens: ['secret'] }, 'authorization', 'Bearer secret')

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('accepts a listed api-key by default header', async () => {
    await using client = await withHeader({ tokens: ['secret'] }, 'x-api-key', 'secret')

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('reads an api-key from a custom header', async () => {
    const auth = { tokens: ['secret'], header: 'x-mcp-token' }

    await using client = await withHeader(auth, 'x-mcp-token', 'secret')
    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()

    await expect(withHeader(auth, 'x-api-key', 'secret')).rejects.toThrow()
  })

  it('restricts to the schemes listed', async () => {
    const auth = { tokens: ['secret'], schemes: ['bearer' as const] }

    await expect(withHeader(auth, 'x-api-key', 'secret')).rejects.toThrow()
  })

  it('trims surrounding whitespace before comparing', async () => {
    await using client = await withHeader(
      { tokens: ['secret'] },
      'authorization',
      'Bearer  secret  ',
    )

    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })

  it('carries resourceMetadataUrl on the challenge', async () => {
    const handler = createMcpHandler({
      auth: {
        tokens: ['secret'],
        resourceMetadataUrl: 'https://example.com/.well-known/oauth-protected-resource',
      },
    })
    const response = await handler.fetch(request())

    expect(response.headers.get('www-authenticate')).toBe(
      'Bearer realm="mcp", resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
    )
  })
})

describe('a custom validate callback', () => {
  it('runs for every credential, and can stash identity on event.context', async () => {
    const seen: unknown[] = []
    const auth: McpAuthOptions = {
      validate: (credential, event) => {
        seen.push(credential)
        event.context.tenant = 'acme'
        return credential.token === 'good'
      },
    }

    await using client = await withHeader(auth, 'authorization', 'Bearer good')
    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
    expect(seen.length).toBeGreaterThan(0)
    expect(seen).toContainEqual({ scheme: 'bearer', token: 'good' })
  })

  it('refuses when it returns false', async () => {
    const auth: McpAuthOptions = { validate: () => false }

    await expect(withHeader(auth, 'authorization', 'Bearer anything')).rejects.toThrow()
  })

  it('falls through to validate when the token is not on the list', async () => {
    const auth: McpAuthOptions = {
      tokens: ['static'],
      validate: (credential) => credential.token === 'dynamic',
    }

    await using client = await withHeader(auth, 'authorization', 'Bearer dynamic')
    await expect(client.callTool({ name: 'ping' })).resolves.toBeDefined()
  })
})
