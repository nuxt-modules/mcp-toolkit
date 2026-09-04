import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import {
  authorizationServerMetadataUrl,
  createMcpHandler,
  createMcpOAuth,
  defineMcpTool,
  protectedResourceMetadataUrl,
} from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'
import type { AddressInfo } from 'node:net'
import type { JWK } from 'jose'

function ping(url = 'http://localhost:3030/mcp', token?: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
  })
}

describe('protectedResourceMetadataUrl', () => {
  it('inserts the well-known prefix in front of the resource path', () => {
    expect(protectedResourceMetadataUrl('https://api.example.com/mcp').href).toBe(
      'https://api.example.com/.well-known/oauth-protected-resource/mcp',
    )
  })

  it('omits the path when the resource is the origin', () => {
    expect(protectedResourceMetadataUrl('https://api.example.com/').href).toBe(
      'https://api.example.com/.well-known/oauth-protected-resource',
    )
  })

  it('allows loopback HTTP', () => {
    expect(protectedResourceMetadataUrl('http://localhost:3030/mcp').href).toBe(
      'http://localhost:3030/.well-known/oauth-protected-resource/mcp',
    )
  })

  it('refuses a public HTTP resource', () => {
    expect(() => protectedResourceMetadataUrl('http://api.example.com/mcp')).toThrow(
      /must be HTTPS/,
    )
  })

  it('refuses a query string', () => {
    expect(() => protectedResourceMetadataUrl('https://api.example.com/mcp?x=1')).toThrow(
      /query or fragment/,
    )
  })
})

describe('authorizationServerMetadataUrl', () => {
  it('inserts the well-known prefix in front of an issuer path', () => {
    expect(authorizationServerMetadataUrl('https://acme.okta.com/oauth2/default').href).toBe(
      'https://acme.okta.com/.well-known/oauth-authorization-server/oauth2/default',
    )
  })

  it('stays at the origin when the issuer has no path', () => {
    expect(authorizationServerMetadataUrl('https://acme.clerk.accounts.dev').href).toBe(
      'https://acme.clerk.accounts.dev/.well-known/oauth-authorization-server',
    )
  })
})

describe('createMcpOAuth', () => {
  it('throws without jwt or verify', () => {
    expect(() =>
      createMcpOAuth({
        resource: 'https://api.example.com/mcp',
        authorizationServers: ['https://auth.example.com'],
      }),
    ).toThrow(/needs `jwt` or `verify`/)
  })

  it('throws without an authorization server', () => {
    expect(() =>
      createMcpOAuth({
        resource: 'https://api.example.com/mcp',
        authorizationServers: [],
        verify: () => true,
      }),
    ).toThrow(/at least one issuer/)
  })

  it('builds metadata and a bearer auth gate', () => {
    const oauth = createMcpOAuth({
      resource: 'https://api.example.com/mcp',
      authorizationServers: ['https://auth.example.com'],
      scopesSupported: ['mcp:read'],
      verify: () => true,
    })

    expect(oauth.metadataPath).toBe('/.well-known/oauth-protected-resource/mcp')
    expect(oauth.resourceMetadataUrl).toBe(
      'https://api.example.com/.well-known/oauth-protected-resource/mcp',
    )
    expect(oauth.auth.schemes).toEqual(['bearer'])
    expect(oauth.auth.resourceMetadataUrl).toBe(oauth.resourceMetadataUrl)
  })

  it('answers RFC 9728 metadata with CORS, including OPTIONS', async () => {
    const oauth = createMcpOAuth({
      resource: 'https://api.example.com/mcp',
      authorizationServers: ['https://auth.example.com'],
      verify: () => true,
    })
    const event = {
      req: new Request('https://api.example.com/.well-known/oauth-protected-resource/mcp', {
        method: 'GET',
      }),
    }

    const response = oauth.metadataHandler(event as never)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.json()).toMatchObject({
      resource: 'https://api.example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      bearer_methods_supported: ['header'],
    })

    const preflight = oauth.metadataHandler({
      req: new Request('https://api.example.com/.well-known/oauth-protected-resource/mcp', {
        method: 'OPTIONS',
      }),
    } as never)
    expect(preflight.status).toBe(204)
  })

  it('challenges with resource_metadata and refuses a bad token', async () => {
    const oauth = createMcpOAuth({
      resource: 'http://localhost:3030/mcp',
      authorizationServers: ['https://auth.example.com'],
      verify: (token) => token === 'good',
    })
    const handler = createMcpHandler({ auth: oauth.auth })

    const unauthenticated = await handler.fetch(ping())
    expect(unauthenticated.status).toBe(401)
    expect(unauthenticated.headers.get('www-authenticate')).toBe(
      `Bearer realm="mcp", resource_metadata="${oauth.resourceMetadataUrl}"`,
    )

    const denied = await handler.fetch(ping('http://localhost:3030/mcp', 'nope'))
    expect(denied.status).toBe(401)
  })

  it('lets a verified bearer through, and tools see what verify stashed', async () => {
    const oauth = createMcpOAuth({
      resource: 'http://localhost:3030/mcp',
      authorizationServers: ['https://auth.example.com'],
      verify: (token, event) => {
        if (token !== 'good') return false
        event.context.oauth = { sub: 'ada' }
        return true
      },
    })
    const handler = createMcpHandler({
      auth: oauth.auth,
      tools: [
        defineMcpTool({ name: 'who', handler: (event) => String(event.context.oauth?.sub ?? '') }),
      ],
    })

    await using client = await createMcpTestClient(handler, {
      headers: { authorization: 'Bearer good' },
    })

    expect(textOf(await client.callTool({ name: 'who' }))).toBe('ada')
  })
})

const RESOURCE = 'http://localhost:3030/mcp'
const ISSUER = 'http://127.0.0.1:9999'

describe('createMcpOAuth jwt', () => {
  let privateKey: CryptoKey
  let jwksUrl: string
  let closeJwks: () => Promise<void>

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256')
    privateKey = pair.privateKey
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' }
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ keys: [jwk] }))
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const { port } = server.address() as AddressInfo
    jwksUrl = `http://127.0.0.1:${port}/jwks`
    closeJwks = () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
  })

  afterAll(() => closeJwks())

  async function sign(
    claims: Record<string, unknown> = {},
    aud: string | false = RESOURCE,
    iss = ISSUER,
  ) {
    let jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('ada')
      .setIssuer(iss)
      .setExpirationTime('5m')
    if (aud !== false) jwt = jwt.setAudience(aud)
    return jwt.sign(privateKey)
  }

  function handler(audience?: string | false, authorizedParties?: string[]) {
    const oauth = createMcpOAuth({
      resource: RESOURCE,
      authorizationServers: [ISSUER],
      jwt: {
        jwks: jwksUrl,
        ...(audience === undefined ? {} : { audience }),
        ...(authorizedParties ? { authorizedParties } : {}),
      },
    })
    return createMcpHandler({
      auth: oauth.auth,
      tools: [
        defineMcpTool({
          name: 'who',
          handler: (event) => ({
            sub: event.context.oauth?.sub ?? null,
            name: event.context.oauth?.name ?? null,
            azp: event.context.oauth?.azp ?? null,
          }),
        }),
      ],
    })
  }

  it('accepts a JWT signed by the JWKS and stashes claims on event.context.oauth', async () => {
    const token = await sign({ name: 'Ada' })
    await using client = await createMcpTestClient(handler(), {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(JSON.parse(textOf(await client.callTool({ name: 'who' })))).toEqual({
      sub: 'ada',
      name: 'Ada',
      azp: null,
    })
  })

  it('refuses a JWT bound to another audience', async () => {
    const token = await sign({}, 'https://other.example.com/mcp')
    const response = await handler().fetch(ping(RESOURCE, token))
    expect(response.status).toBe(401)
  })

  it('skips audience when audience is false', async () => {
    const token = await sign({ azp: 'client_abc' }, 'oauth_client')
    await using client = await createMcpTestClient(handler(false), {
      headers: { authorization: `Bearer ${token}` },
    })

    expect(JSON.parse(textOf(await client.callTool({ name: 'who' })))).toMatchObject({
      sub: 'ada',
      azp: 'client_abc',
    })
  })

  it('refuses a token whose azp is not on the allowlist', async () => {
    const token = await sign({ azp: 'other-client' }, false)
    const response = await handler(false, ['client_abc']).fetch(ping(RESOURCE, token))
    expect(response.status).toBe(401)
  })

  it('refuses a token that is not a JWT', async () => {
    const response = await handler().fetch(ping(RESOURCE, 'nope'))
    expect(response.status).toBe(401)
  })
})
