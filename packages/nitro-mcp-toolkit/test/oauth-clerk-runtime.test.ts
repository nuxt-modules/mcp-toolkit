import { H3Event } from 'h3'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { clerk } from '../src/runtime/oauth/clerk.ts'
import type { ClerkOAuthClient } from '../src/runtime/oauth/clerk.ts'
import type { McpOAuth, McpOAuthOptions, McpOAuthSetup } from '../src/runtime/oauth.ts'

const RESOURCE = 'https://api.example.com/mcp'
const ISSUER = 'https://acme.clerk.accounts.dev'
const KEY = `pk_test_${btoa('acme.clerk.accounts.dev$')}`
const OPAQUE = 'oat_example'

function jwt(claims: Record<string, unknown> = {}): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ typ: 'at+jwt', alg: 'RS256' })}.${encode({ iss: ISSUER, ...claims })}.signature`
}

function fixture(overrides = {}) {
  const auth = {
    isAuthenticated: true,
    tokenType: 'oauth_token',
    subject: 'user_alice',
    userId: 'user_alice',
    clientId: 'client_example',
    scopes: ['openid', 'tools:read'],
    getToken: () => Promise.resolve(OPAQUE),
    debug: () => ({ token: OPAQUE }),
    ...overrides,
  }
  const authenticateRequest = vi.fn<ClerkOAuthClient['authenticateRequest']>(async () => ({
    toAuth: () => auth,
  }))
  const client = { authenticateRequest }
  const options = clerk({ resource: RESOURCE, publishableKey: KEY, client })
  const event = new H3Event(new Request(RESOURCE))
  return { auth, client, options, event }
}

describe('Clerk runtime OAuth', () => {
  it('preserves JWT settings for serializable build-config selection', () => {
    const options = clerk({ resource: RESOURCE, publishableKey: KEY })
    expectTypeOf(options).toEqualTypeOf<McpOAuthSetup & McpOAuth>()
    const config: McpOAuthSetup = {
      resource: options.resource,
      authorizationServers: options.authorizationServers,
      scopesSupported: options.scopesSupported,
      authorizationServer: options.authorizationServer,
      jwt: options.jwt,
    }
    expect(JSON.parse(JSON.stringify(config))).toEqual(config)
    expect(options).not.toHaveProperty('verify')
    expect(options.jwt.jwks).toBe(`${ISSUER}/.well-known/jwks.json`)
    expect(options.auth.validate).toBeTypeOf('function')
  })

  it('returns runtime options without a second JWT verifier', () => {
    const { options } = fixture()
    expectTypeOf(options).toEqualTypeOf<McpOAuthOptions & McpOAuth>()
    expect(options).not.toHaveProperty('jwt')
    expect(options.authorizationServers).toEqual([ISSUER])
    expect(options.authorizationServer).toBe(ISSUER)
    expect(options.scopesSupported).toEqual(['openid', 'profile', 'email'])
  })

  it('passes the advertised audience to the SDK for a resource with a trailing slash', async () => {
    const { client, event } = fixture()
    const options = clerk({ resource: `${RESOURCE}/`, publishableKey: KEY, client })
    expect(options.metadata.resource).toBe(RESOURCE)
    expect(await options.auth.validate?.({ scheme: 'bearer', token: OPAQUE }, event)).toBe(true)
    expect(client.authenticateRequest.mock.calls[0]?.[1].audience).toBe(options.metadata.resource)
    expect(event.context.oauth?.aud).toBe(options.metadata.resource)
  })

  it.each([OPAQUE, jwt()])(
    'authenticates OAuth token %s with an explicit resource audience',
    async (token) => {
      const { options, client, event } = fixture()
      expect(await options.verify?.(token, event)).toBe(true)
      const [request, sdkOptions] = client.authenticateRequest.mock.calls[0]!
      expect(request.url).toBe(RESOURCE)
      expect(request.headers.get('authorization')).toBe(`Bearer ${token}`)
      expect(sdkOptions).toEqual({
        acceptsToken: 'oauth_token',
        audience: RESOURCE,
        publishableKey: KEY,
      })
      expect(event.context.oauth).toEqual({
        sub: 'user_alice',
        iss: ISSUER,
        aud: RESOURCE,
        client_id: 'client_example',
        scope: 'openid tools:read',
      })
      expect(JSON.stringify(event.context.oauth)).not.toContain(token)
      expect(event.context.oauth).not.toHaveProperty('getToken')
      expect(event.context.oauth).not.toHaveProperty('debug')
    },
  )

  it('passes the validated credential instead of cookies or another Authorization header', async () => {
    const { options, client } = fixture()
    const request = new Request(RESOURCE, {
      method: 'POST',
      headers: { authorization: 'Bearer wrong', cookie: '__session=other', 'x-request-id': '123' },
      body: 'request body',
    })
    const event = new H3Event(request)
    expect(await options.verify?.(OPAQUE, event)).toBe(true)
    const [sdkRequest] = client.authenticateRequest.mock.calls[0]!
    expect(sdkRequest.headers.get('authorization')).toBe(`Bearer ${OPAQUE}`)
    expect(sdkRequest.headers.has('cookie')).toBe(false)
    expect(sdkRequest.headers.get('x-request-id')).toBe('123')
    expect(await request.text()).toBe('request body')
  })

  it.each([
    { isAuthenticated: false },
    { tokenType: 'session_token' },
    { tokenType: 'api_key' },
    { tokenType: 'm2m_token' },
    { subject: '' },
    { userId: 'user_bob' },
    { userId: null },
    { clientId: null },
    { scopes: null },
  ])('refuses unauthenticated or inconsistent OAuth principals: %j', async (overrides) => {
    const { options, event } = fixture(overrides)
    expect(await options.verify?.(OPAQUE, event)).toBe(false)
    expect(event.context.oauth).toBeUndefined()
  })

  it('keeps an empty granted scope set empty', async () => {
    const { options, event } = fixture({ scopes: [] })
    expect(await options.verify?.(OPAQUE, event)).toBe(true)
    expect(event.context.oauth?.scope).toBe('')
  })

  it('refuses a null SDK auth result', async () => {
    const { options, event, client } = fixture()
    client.authenticateRequest.mockResolvedValueOnce({ toAuth: () => null })
    expect(await options.verify?.(OPAQUE, event)).toBe(false)
    expect(event.context.oauth).toBeUndefined()
  })

  it('does not swallow SDK failures', async () => {
    const { options, event, client } = fixture()
    client.authenticateRequest.mockRejectedValueOnce(new Error('SDK unavailable'))
    await expect(options.verify?.(OPAQUE, event)).rejects.toThrow('SDK unavailable')
    expect(event.context.oauth).toBeUndefined()
  })

  it.each([{ jkt: 'thumbprint' }, { 'x5t#S256': 'thumbprint' }, null])(
    'rejects proof-bound JWTs with cnf %j',
    async (cnf) => {
      const { options, event, client } = fixture()
      expect(await options.verify?.(jwt({ cnf }), event)).toBe(false)
      expect(client.authenticateRequest).not.toHaveBeenCalled()
      expect(event.context.oauth).toBeUndefined()
    },
  )

  it('rejects DPoP proof headers for opaque tokens too', async () => {
    const { options, client } = fixture()
    const event = new H3Event(new Request(RESOURCE, { headers: { dpop: 'proof' } }))
    expect(await options.verify?.(OPAQUE, event)).toBe(false)
    expect(client.authenticateRequest).not.toHaveBeenCalled()
  })

  it.each([jwt({ iss: 'https://other.clerk.accounts.dev' }), 'bad.payload.signature'])(
    'rejects another issuer or malformed JWT: %s',
    async (token) => {
      const { options, event, client } = fixture()
      expect(await options.verify?.(token, event)).toBe(false)
      expect(client.authenticateRequest).not.toHaveBeenCalled()
    },
  )

  it('enforces authorizedParties without treating client_id as azp', async () => {
    const { client, event } = fixture()
    const options = clerk({
      resource: RESOURCE,
      publishableKey: KEY,
      client,
      authorizedParties: ['https://app.example.com'],
    })
    expect(await options.verify?.(jwt({ azp: 'https://app.example.com' }), event)).toBe(true)
    expect(await options.verify?.(jwt({ azp: 'https://other.example.com' }), event)).toBe(false)
    expect(await options.verify?.(jwt(), event)).toBe(false)
    expect(await options.verify?.(OPAQUE, event)).toBe(false)
    expect(client.authenticateRequest).toHaveBeenCalledTimes(1)
  })

  it('denies every token when authorizedParties is empty', async () => {
    const { client, event } = fixture()
    const options = clerk({
      resource: RESOURCE,
      publishableKey: KEY,
      client,
      authorizedParties: [],
    })
    expect(await options.verify?.(jwt({ azp: 'https://app.example.com' }), event)).toBe(false)
    expect(await options.verify?.(OPAQUE, event)).toBe(false)
    expect(client.authenticateRequest).not.toHaveBeenCalled()
  })

  it('uses the existing publishable-key environment helper', () => {
    const { client } = fixture()
    vi.stubEnv('CLERK_PUBLISHABLE_KEY', KEY)
    try {
      expect(clerk({ resource: RESOURCE, client }).authorizationServers).toEqual([ISSUER])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('provides prepared OAuth authentication and preserves granted scope ownership', async () => {
    const { options, event, client } = fixture()
    const oauth = options
    if (typeof oauth.auth.validate !== 'function') throw new Error('Missing OAuth validator')
    expect(await oauth.auth.validate({ scheme: 'bearer', token: OPAQUE }, event)).toBe(true)
    expect(event.context.oauth?.sub).toBe('user_alice')
    expect(event.context.oauth?.scope).toBe('openid tools:read')
    client.authenticateRequest.mockResolvedValueOnce({
      toAuth: () => ({ isAuthenticated: false, tokenType: 'oauth_token' }),
    })
    expect(
      await oauth.auth.validate({ scheme: 'bearer', token: 'oat_wrong_audience' }, event),
    ).toBe(false)
  })
})
