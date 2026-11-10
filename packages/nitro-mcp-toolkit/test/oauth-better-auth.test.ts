import { createServer } from 'node:http'
import { H3Event } from 'h3'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { betterAuth } from '../src/runtime/oauth/better-auth.ts'

const RESOURCE = 'https://api.example.com/mcp'
const ISSUER = 'https://auth.example.com/api/auth'

describe('betterAuth', () => {
  let jwks: string
  let sign: (claims?: Record<string, unknown>, typ?: string) => Promise<string>
  let close: (() => Promise<void>) | undefined

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256')
    const key = { ...(await exportJWK(publicKey)), kid: 'better-auth-test', alg: 'ES256' }
    const server = createServer((req, res) => {
      res.setHeader('content-type', 'application/json')
      if (req.url === '/jwks/unavailable') {
        res.writeHead(503)
        res.end(JSON.stringify({ error: 'unavailable' }))
        return
      }
      res.end(JSON.stringify({ keys: [key] }))
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing JWKS server address')
    jwks = `http://127.0.0.1:${address.port}/jwks`
    close = () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    sign = (claims = {}, typ = 'at+jwt') =>
      new SignJWT({
        iss: ISSUER,
        aud: RESOURCE,
        sub: 'alice',
        azp: 'mcp-client',
        scope: 'mcp:read',
        exp: Math.floor(Date.now() / 1000) + 300,
        ...claims,
      })
        .setProtectedHeader({ alg: 'ES256', kid: key.kid, ...(typ ? { typ } : {}) })
        .sign(privateKey)
  })

  afterAll(async () => close?.())

  function setup() {
    return betterAuth({ resource: RESOURCE, issuer: ISSUER, jwks })
  }

  function event() {
    return new H3Event(new Request(RESOURCE))
  }

  it('returns prepared resource-server options with explicit provider URLs and advertised scopes', () => {
    const options = betterAuth({
      resource: RESOURCE,
      issuer: ISSUER,
      jwks,
      scopesSupported: ['mcp:read'],
    })

    expect(options).toMatchObject({
      resource: RESOURCE,
      authorizationServers: [ISSUER],
      authorizationServer: ISSUER,
      scopesSupported: ['mcp:read'],
      verify: expect.any(Function),
    })
    expect(options.jwt).toBeUndefined()
    expect(options.metadata.scopes_supported).toEqual(['mcp:read'])
    expect(options.auth.schemes).toEqual(['bearer'])
    expect(options.authorizationServerHandler).toBeTypeOf('function')
  })

  it('uses the official verifier through the prepared bearer auth gate', async () => {
    const options = setup()
    const request = event()
    expect(await options.auth.validate?.({ scheme: 'bearer', token: await sign() }, request)).toBe(
      true,
    )
    expect(request.context.oauth?.sub).toBe('alice')
    expect(
      await options.auth.validate?.({ scheme: 'bearer', token: await sign({}, 'JWT') }, request),
    ).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it('verifies the resource audience advertised for a URL with a trailing slash', async () => {
    const options = betterAuth({ resource: `${RESOURCE}/`, issuer: ISSUER, jwks })
    expect(options.metadata.resource).toBe(RESOURCE)
    const request = event()
    expect(await options.auth.validate?.({ scheme: 'bearer', token: await sign() }, request)).toBe(
      true,
    )
    expect(request.context.oauth?.aud).toBe(options.metadata.resource)
  })

  it('verifies a signed access token with the official verifier and publishes its claims', async () => {
    const request = event()
    expect(await setup().verify?.(await sign(), request)).toBe(true)
    expect(request.context.oauth).toMatchObject({
      sub: 'alice',
      iss: ISSUER,
      aud: RESOURCE,
      scope: 'mcp:read',
      azp: 'mcp-client',
      client_id: 'mcp-client',
    })
  })

  it.each(['JWT', ''])(
    'rejects a session JWT with typ %j even with matching issuer and audience',
    async (typ) => {
      const request = event()
      expect(await setup().verify?.(await sign({}, typ), request)).toBe(false)
      expect(request.context.oauth).toBeUndefined()
    },
  )

  it.each([
    { azp: undefined },
    { azp: '' },
    { azp: 123 },
    { sub: undefined },
    { sub: '' },
    { sub: 123 },
    { aud: 'https://other.example.com/mcp' },
    { aud: undefined },
    { iss: 'https://other.example.com/api/auth' },
    { iss: undefined },
    { exp: 1 },
    { exp: undefined },
    { exp: 'tomorrow' },
    { nbf: 9_999_999_999 },
  ])('rejects invalid access-token claims %j', async (claims) => {
    const request = event()
    expect(await setup().verify?.(await sign(claims), request)).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it.each([
    { jkt: 'proof-key-thumbprint' },
    { 'x5t#S256': 'certificate-thumbprint' },
    {},
    null,
    'invalid-confirmation',
  ])('rejects proof-bound or malformed confirmation claims %j', async (cnf) => {
    const request = event()
    expect(await setup().verify?.(await sign({ cnf }), request)).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it('rejects an opaque Better Auth session token without consulting a session database', async () => {
    const request = event()
    expect(await setup().verify?.('opaque-session-token', request)).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it('rejects a token signed by a different key', async () => {
    const { privateKey } = await generateKeyPair('ES256')
    const forged = await new SignJWT({ azp: 'mcp-client' })
      .setIssuer(ISSUER)
      .setAudience(RESOURCE)
      .setSubject('mallory')
      .setExpirationTime('5m')
      .setProtectedHeader({ alg: 'ES256', kid: 'better-auth-test', typ: 'at+jwt' })
      .sign(privateKey)
    const request = event()
    expect(await setup().verify?.(forged, request)).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it('keeps identities isolated across concurrent requests', async () => {
    const options = setup()
    const alice = event()
    const bob = event()
    const rejected = event()
    expect(
      await Promise.all([
        options.verify?.(await sign({ sub: 'alice' }), alice),
        options.verify?.(await sign({ sub: 'bob' }), bob),
        options.verify?.(
          await sign({ sub: 'mallory', aud: 'https://other.example.com' }),
          rejected,
        ),
      ]),
    ).toEqual([true, true, false])
    expect(alice.context.oauth?.sub).toBe('alice')
    expect(bob.context.oauth?.sub).toBe('bob')
    expect(rejected.context.oauth).toBeUndefined()
    expect(alice.context.oauth).not.toBe(bob.context.oauth)
  })

  it('clears stale claims when subsequent verification fails', async () => {
    const options = setup()
    const request = event()
    expect(await options.verify?.(await sign(), request)).toBe(true)
    expect(await options.verify?.(await sign({ cnf: { jkt: 'proof-key' } }), request)).toBe(false)
    expect(request.context.oauth).toBeUndefined()
  })

  it('propagates verifier infrastructure failures without exposing an identity', async () => {
    const options = betterAuth({ resource: RESOURCE, issuer: ISSUER, jwks: `${jwks}/unavailable` })
    const request = event()
    request.context.oauth = { sub: 'stale-user' }
    await expect(options.verify?.(await sign(), request)).rejects.toThrow(/Jwks failed/)
    expect(request.context.oauth).toBeUndefined()
  })

  it.each(['resource', 'issuer', 'jwks'])('rejects insecure %s configuration', (field) => {
    expect(() =>
      betterAuth({
        resource: RESOURCE,
        issuer: ISSUER,
        jwks,
        [field]: 'http://public.example.com',
      }),
    ).toThrow(/must be HTTPS/)
  })
})
