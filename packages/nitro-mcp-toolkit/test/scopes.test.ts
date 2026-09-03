import { describe, expect, it } from 'vitest'
import {
  MODERN_PROTOCOL_VERSION,
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from '../src/runtime/index.ts'
import { grantedScopes } from '../src/runtime/scopes.ts'
import { createMcpTestClient } from '../src/testing/index.ts'
import type { McpPrompt, McpResource, McpTool } from '../src/runtime/index.ts'

/**
 * Stands in for `createMcpOAuth` without a JWKS: the bearer token is read as
 * the granted scope list, and the claims land where a verified token puts them.
 */
function servingWithScopes(...definitions: (McpTool | McpResource | McpPrompt)[]) {
  return createMcpHandler({
    name: 'test',
    version: '1.0.0',
    auth: {
      schemes: ['bearer'],
      validate: (credential, event) => {
        event.context.oauth = { sub: 'user_1', scope: credential.token }
        return true
      },
    },
    tools: definitions.filter((definition): definition is McpTool => definition.kind === 'tool'),
    resources: definitions.filter(
      (definition): definition is McpResource => definition.kind === 'resource',
    ),
    prompts: definitions.filter(
      (definition): definition is McpPrompt => definition.kind === 'prompt',
    ),
  })
}

function asUser(handler: ReturnType<typeof createMcpHandler>, scope: string) {
  return createMcpTestClient(handler, { headers: { authorization: `Bearer ${scope}` } })
}

const writeTodos = defineMcpTool({
  name: 'remove-todo',
  scopes: ['todos:write'],
  handler: () => 'removed',
})

describe('grantedScopes', () => {
  it('reads the space-delimited scope claim RFC 6749 defines', () => {
    expect(grantedScopes({ scope: 'openid todos:read todos:write' })).toEqual(
      new Set(['openid', 'todos:read', 'todos:write']),
    )
  })

  it('reads scp as an array, which Okta and Entra ID send', () => {
    expect(grantedScopes({ scp: ['todos:read', 'todos:write'] })).toEqual(
      new Set(['todos:read', 'todos:write']),
    )
  })

  it('reads scp as a string too', () => {
    expect(grantedScopes({ scp: 'todos:read todos:write' })).toEqual(
      new Set(['todos:read', 'todos:write']),
    )
  })

  it('merges both claims when a token carries them', () => {
    expect(grantedScopes({ scope: 'openid', scp: ['todos:read'] })).toEqual(
      new Set(['openid', 'todos:read']),
    )
  })

  it('grants nothing without claims, and ignores padding', () => {
    expect(grantedScopes(undefined)).toEqual(new Set())
    expect(grantedScopes({})).toEqual(new Set())
    expect(grantedScopes({ scope: '  todos:read   todos:write ' })).toEqual(
      new Set(['todos:read', 'todos:write']),
    )
  })

  it('ignores non-string entries in scp rather than granting them', () => {
    expect(grantedScopes({ scp: ['todos:read', 7, null] })).toEqual(new Set(['todos:read']))
  })
})

describe('a tool declaring scopes', () => {
  it('runs for a token carrying every one of them', async () => {
    await using client = await asUser(servingWithScopes(writeTodos), 'openid todos:write')

    const result = await client.callTool({ name: 'remove-todo', arguments: {} })

    expect(result.content).toEqual([{ type: 'text', text: 'removed' }])
  })

  it('refuses a token that carries none of them', async () => {
    await using client = await asUser(servingWithScopes(writeTodos), 'openid')

    // `-32003` is JSON-RPC's implementation-defined server range; the `403` it
    // carries is the HTTP status the engine reports it under.
    await expect(client.callTool({ name: 'remove-todo', arguments: {} })).rejects.toThrow(
      /"code":-32003.*requires todos:write/,
    )
  })

  it('names only the scopes actually missing', async () => {
    const strict = defineMcpTool({
      name: 'audit',
      scopes: ['todos:read', 'todos:write'],
      handler: () => 'audited',
    })

    await using client = await asUser(servingWithScopes(strict), 'todos:read')

    await expect(client.callTool({ name: 'audit', arguments: {} })).rejects.toThrow(
      '"missingScopes":["todos:write"]',
    )
  })

  // The token is what carries scopes, so a server with no OAuth cannot satisfy
  // one — declaring scopes there is a misconfiguration, not an open door.
  it('refuses when the endpoint has no OAuth at all', async () => {
    await using client = await createMcpTestClient(
      createMcpHandler({ name: 'test', tools: [writeTodos] }),
    )

    await expect(client.callTool({ name: 'remove-todo', arguments: {} })).rejects.toThrow(
      /requires todos:write/,
    )
  })

  it('leaves a tool that declares none alone', async () => {
    const open = defineMcpTool({ name: 'ping', handler: () => 'pong' })

    await using client = await asUser(servingWithScopes(open), 'openid')

    const result = await client.callTool({ name: 'ping', arguments: {} })

    expect(result.content).toEqual([{ type: 'text', text: 'pong' }])
  })

  // The engine resolves a handler's options before it authenticates, so no
  // listing can see the claims: the tool is advertised and the call is refused.
  it('is still advertised, with its scopes in _meta', async () => {
    await using client = await asUser(servingWithScopes(writeTodos), 'openid')

    const { tools } = await client.listTools()

    expect(tools).toHaveLength(1)
    expect(tools[0]?._meta).toEqual({ scopes: ['todos:write'] })
  })
})

describe('a resource or prompt declaring scopes', () => {
  it('refuses a read without them', async () => {
    const secret = defineMcpResource({
      name: 'secret',
      uri: 'app://secret',
      scopes: ['files:read'],
      handler: () => 'classified',
    })

    await using client = await asUser(servingWithScopes(secret), 'openid')

    await expect(client.readResource({ uri: 'app://secret' })).rejects.toThrow(
      /requires files:read/,
    )
  })

  it('refuses a templated read without them', async () => {
    const perSlug = defineMcpResource({
      name: 'doc',
      uriTemplate: 'app://docs/{slug}',
      scopes: ['files:read'],
      handler: () => 'classified',
    })

    await using client = await asUser(servingWithScopes(perSlug), 'openid')

    await expect(client.readResource({ uri: 'app://docs/intro' })).rejects.toThrow(
      /requires files:read/,
    )
  })

  it('refuses an expansion without them', async () => {
    const review = defineMcpPrompt({
      name: 'review',
      scopes: ['code:read'],
      handler: () => 'Review it.',
    })

    await using client = await asUser(servingWithScopes(review), 'openid')

    await expect(client.getPrompt({ name: 'review' })).rejects.toThrow(/requires code:read/)
  })

  it('allows the read once the token carries them', async () => {
    const secret = defineMcpResource({
      name: 'secret',
      uri: 'app://secret',
      scopes: ['files:read'],
      handler: () => 'classified',
    })

    await using client = await asUser(servingWithScopes(secret), 'files:read')

    const { contents } = await client.readResource({ uri: 'app://secret' })

    expect(contents[0]).toMatchObject({ text: 'classified' })
  })
})

describe('the status a refusal comes back under', () => {
  // The `403` only reaches the wire on the modern revision. A legacy request
  // carries the same error inside a `200` stream, as it does for every error.
  it('answers a modern request with HTTP 403', async () => {
    const handler = servingWithScopes(writeTodos)
    const envelope = 'io.modelcontextprotocol/'

    const response = await handler.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
          'mcp-method': 'tools/call',
          'mcp-name': 'remove-todo',
          authorization: 'Bearer openid',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'remove-todo',
            arguments: {},
            _meta: {
              [`${envelope}protocolVersion`]: MODERN_PROTOCOL_VERSION,
              [`${envelope}clientCapabilities`]: {},
            },
          },
        }),
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: -32003, data: { missingScopes: ['todos:write'] } },
    })
  })
})

describe('what a handler reports about scopes', () => {
  it('carries them in definitions, beside the tags', () => {
    const handler = servingWithScopes(
      writeTodos,
      defineMcpTool({ name: 'ping', tags: ['public'], handler: () => 'pong' }),
    )

    expect(handler.definitions).toEqual([
      { kind: 'tool', name: 'remove-todo', scopes: ['todos:write'] },
      { kind: 'tool', name: 'ping', tags: ['public'] },
    ])
  })
})
