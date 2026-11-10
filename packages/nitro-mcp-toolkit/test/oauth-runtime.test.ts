import { describe, expect, it } from 'vitest'
import {
  createMcpHandler,
  createMcpOAuth,
  defineMcpServer,
  defineMcpTool,
} from '../src/runtime/index.ts'

const resource = 'https://example.com/mcp'
const request = (token?: string, version = '2026-07-28', tools?: string) =>
  new Request(resource, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': version,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(tools ? { 'x-mcp-tools': tools } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  })

const provider = {
  resource,
  authorizationServers: ['https://auth.example.com'],
  verify: (
    token: string,
    event: Parameters<NonNullable<Parameters<typeof createMcpOAuth>[0]['verify']>>[1],
  ) => {
    if (!['member', 'outsider'].includes(token)) return false
    event.context.oauth = { sub: token, scope: 'read' }
    return true
  },
}

describe('runtime OAuth server configuration', () => {
  it('prepares discovery once and can be passed to a handler or normalized again', async () => {
    const config = defineMcpServer({ oauth: createMcpOAuth(provider) })
    expect(defineMcpServer(config).oauth).toBe(config.oauth)
    const handler = createMcpHandler(config)
    expect(handler.oauth?.metadata).toMatchObject({
      resource,
      authorization_servers: provider.authorizationServers,
    })
    expect((await handler.fetch(request())).status).toBe(401)
    expect((await handler.fetch(request('member'))).status).toBe(200)
  })

  it.each(['2025-11-25', '2026-07-28'])(
    'authorizes each authenticated request on %s',
    async (version) => {
      const identities: string[] = []
      let allowed = true
      const handler = createMcpHandler(
        defineMcpServer({
          oauth: createMcpOAuth(provider),
          authorize(identity, event) {
            identities.push(identity.sub)
            expect(event.context.oauth?.scope).toBe('read')
            return allowed && identity.sub === 'member'
          },
        }),
      )
      expect((await handler.fetch(request(undefined, version))).status).toBe(401)
      expect((await handler.fetch(request('invalid', version))).status).toBe(401)
      expect(identities).toEqual([])
      expect((await handler.fetch(request('member', version))).status).toBe(200)
      const denied = await handler.fetch(request('outsider', version))
      expect(denied.status).toBe(403)
      expect(denied.headers.has('www-authenticate')).toBe(false)
      allowed = false
      expect((await handler.fetch(request('member', version))).status).toBe(403)
      expect(identities).toEqual(['member', 'outsider', 'member'])
    },
  )

  it('runs authorization before revealing unknown tool names', async () => {
    const handler = createMcpHandler({
      ...defineMcpServer({
        oauth: createMcpOAuth(provider),
        authorize: (identity) => identity.sub === 'member',
      }),
      tools: [defineMcpTool({ name: 'known', handler: () => 'ok' })],
    })
    expect((await handler.fetch(request('outsider', undefined, 'secret'))).status).toBe(403)
    expect((await handler.fetch(request('member', undefined, 'secret'))).status).toBe(400)
  })

  it('does not trust middleware identity when a verifier returns no identity', async () => {
    const handler = createMcpHandler(
      defineMcpServer({
        oauth: createMcpOAuth({ ...provider, verify: () => true }),
        authorize: () => true,
      }),
    )
    expect((await handler.fetch(request('token'), { oauth: { sub: 'middleware' } })).status).toBe(
      401,
    )
  })

  it('keeps concurrent request identities separate', async () => {
    const handler = createMcpHandler(
      defineMcpServer({
        oauth: createMcpOAuth(provider),
        authorize: async (identity) => {
          await Promise.resolve()
          return identity.sub === 'member'
        },
      }),
    )
    expect(
      await Promise.all(
        ['member', 'outsider', 'member'].map(
          async (token) => (await handler.fetch(request(token))).status,
        ),
      ),
    ).toEqual([200, 403, 200])
  })

  it('rejects conflicting auth and missing OAuth configuration', () => {
    expect(() => defineMcpServer({ oauth: createMcpOAuth(provider), auth: false })).toThrow(
      'cannot both',
    )
    expect(() => createMcpHandler({ authorize: () => true })).toThrow('requires OAuth')
    expect(() => createMcpHandler({ oauth: createMcpOAuth(provider), auth: false })).toThrow(
      'cannot both',
    )
  })

  it('refuses invalid or disabled OAuth instead of serving a public endpoint', () => {
    const prepared = createMcpOAuth(provider)
    for (const oauth of [
      null,
      false,
      {},
      provider,
      { ...prepared, auth: { ...prepared.auth, enabled: false } },
    ]) {
      for (const factory of [defineMcpServer, createMcpHandler]) {
        expect(() => Reflect.apply(factory, undefined, [{ oauth }])).toThrow(
          'createMcpOAuth or a provider adapter',
        )
      }
    }
  })
})
