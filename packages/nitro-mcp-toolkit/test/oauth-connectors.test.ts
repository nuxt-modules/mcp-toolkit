import { describe, expect, it } from 'vitest'
import { createMcpOAuth } from '../src/runtime/index.ts'
import { clerk } from '../src/runtime/oauth/clerk.ts'
import { okta } from '../src/runtime/oauth/okta.ts'
import { workos } from '../src/runtime/oauth/workos.ts'

const RESOURCE = 'https://api.example.com/mcp'

function clerkKey(host = 'acme.clerk.accounts.dev'): string {
  return `pk_test_${Buffer.from(`${host}$`, 'utf8').toString('base64')}`
}

function withoutEnv(names: string[], run: () => void): void {
  const previous = names.map((name) => [name, process.env[name]] as const)

  for (const name of names) delete process.env[name]

  try {
    run()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

describe('clerk', () => {
  it('fills issuer and JWKS from a publishable key', () => {
    const options = clerk({ resource: RESOURCE, publishableKey: clerkKey() })

    expect(options.authorizationServers).toEqual(['https://acme.clerk.accounts.dev'])
    expect(options.jwt).toEqual({
      jwks: 'https://acme.clerk.accounts.dev/.well-known/jwks.json',
      issuer: 'https://acme.clerk.accounts.dev',
      audience: false,
    })
    expect(options.scopesSupported).toEqual(['openid', 'profile', 'email'])
    expect(options.authorizationServer).toBe('https://acme.clerk.accounts.dev')
  })

  it('throws without a publishable key', () => {
    withoutEnv(['CLERK_PUBLISHABLE_KEY', 'NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY'], () => {
      expect(() => clerk({ resource: RESOURCE })).toThrow(/publishableKey/)
    })
  })

  it('refuses a non-Clerk key', () => {
    expect(() => clerk({ resource: RESOURCE, publishableKey: 'sk_test_nope' })).toThrow(
      /publishable key/,
    )
  })

  it('is accepted by createMcpOAuth', () => {
    const oauth = createMcpOAuth(clerk({ resource: RESOURCE, publishableKey: clerkKey() }))

    expect(oauth.metadata.authorization_servers).toEqual(['https://acme.clerk.accounts.dev'])
    expect(oauth.authorizationServerHandler).toBeTypeOf('function')
  })
})

describe('okta', () => {
  it('builds issuer and JWKS from a domain', () => {
    const options = okta({ resource: RESOURCE, domain: 'acme.okta.com' })

    expect(options.authorizationServers).toEqual(['https://acme.okta.com/oauth2/default'])
    expect(options.jwt).toEqual({
      jwks: 'https://acme.okta.com/oauth2/default/v1/keys',
      issuer: 'https://acme.okta.com/oauth2/default',
    })
    expect(options.authorizationServer).toBe('https://acme.okta.com/oauth2/default')
  })

  it('accepts a full custom authorization-server issuer', () => {
    const options = okta({
      resource: RESOURCE,
      issuer: 'https://acme.okta.com/oauth2/aus123',
    })

    expect(options.jwt?.jwks).toBe('https://acme.okta.com/oauth2/aus123/v1/keys')
  })

  it('refuses an org authorization server', () => {
    expect(() => okta({ resource: RESOURCE, issuer: 'https://acme.okta.com' })).toThrow(/opaque/)
  })

  it('refuses a URL passed as domain', () => {
    expect(() => okta({ resource: RESOURCE, domain: 'https://acme.okta.com' })).toThrow(/hostname/)
  })

  it('throws without issuer or domain', () => {
    withoutEnv(['OKTA_ISSUER', 'OKTA_DOMAIN'], () => {
      expect(() => okta({ resource: RESOURCE })).toThrow(/issuer` or `domain/)
    })
  })
})

describe('workos', () => {
  it('verifies AuthKit tokens against the client JWKS', () => {
    const options = workos({ resource: RESOURCE, clientId: 'client_abc' })

    expect(options.authorizationServers).toEqual(['https://api.workos.com'])
    expect(options.jwt).toEqual({
      jwks: 'https://api.workos.com/sso/jwks/client_abc',
      issuer: 'https://api.workos.com',
      audience: 'client_abc',
    })
    expect(options.authorizationServer).toBeUndefined()
  })

  it('throws without a client id', () => {
    withoutEnv(['WORKOS_CLIENT_ID'], () => {
      expect(() => workos({ resource: RESOURCE })).toThrow(/clientId/)
    })
  })
})
