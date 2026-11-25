import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import {
  assertAbsoluteHttpUrl,
  authorizationServerMetadataUrl,
  normalizeResource,
  protectedResourceMetadataUrl,
} from './oauth-url.ts'
import type { H3Event } from 'h3/generic'
import type { JWTPayload } from 'jose'
import type { McpAuthOptions } from './auth.ts'

export { authorizationServerMetadataUrl, protectedResourceMetadataUrl } from './oauth-url.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-max-age': '86400',
  'access-control-expose-headers': 'WWW-Authenticate',
} as const

/**
 * RFC 9728 protected resource metadata. Clients fetch this after a `401` to
 * learn which authorization server issues tokens for this MCP endpoint.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
export interface McpProtectedResourceMetadata {
  resource: string
  authorization_servers: string[]
  bearer_methods_supported: ['header']
  scopes_supported?: string[]
}

/**
 * Claims copied off a verified access token onto `event.context.oauth`.
 * Usual OIDC fields are named; the rest of the JWT payload is passed through.
 */
export interface McpOAuthClaims {
  sub?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  iat?: number
  nbf?: number
  jti?: string
  azp?: string
  org_id?: string
  scope?: string
  name?: string
  email?: string
  email_verified?: boolean
  picture?: string
  [claim: string]: unknown
}

export interface McpOAuthJwtOptions {
  /**
   * JWKS URL of the authorization server. HTTPS, except loopback HTTP in
   * development.
   *
   * @example 'https://auth.example.com/.well-known/jwks.json'
   */
  jwks: string
  /** Defaults to `authorizationServers`. */
  issuer?: string | string[]
  /**
   * Defaults to `resource`. `false` requires a custom `verify` callback that
   * validates resource binding; `azp` alone is not a resource audience.
   */
  audience?: string | string[] | false
  /** When set, the token's `azp` must be one of these. */
  authorizedParties?: string[]
  /** Required protected-header type, for providers using an access-token JWT profile. */
  typ?: string
  requiredClaims?: string[]
}

export interface McpOAuthOptions {
  /**
   * This MCP endpoint as a resource identifier. HTTPS, except loopback HTTP
   * in development. No query, fragment, or credentials.
   *
   * @example 'https://api.example.com/mcp'
   */
  resource: string
  /** Issuers that mint tokens for `resource`. At least one. */
  authorizationServers: string[]
  /** Advertised as `scopes_supported` in resource metadata. */
  scopesSupported?: string[]
  jwt?: McpOAuthJwtOptions
  /**
   * Return `true` when the bearer token is valid for this resource. Runs after
   * `jwt` when both are set. Stash extra fields on `event.context.oauth` —
   * auth runs before any tool handler.
   */
  verify?: (token: string, event: H3Event) => boolean | Promise<boolean>
  /**
   * Static bearer tokens accepted beside OAuth access tokens, for callers that
   * cannot sign in, such as an agent or a scheduled job. Each token is read at
   * request time, so it can come from private runtime configuration; an empty
   * value matches nothing. A match skips `jwt` and `verify` and sets `claims`
   * on `event.context.oauth`, so `scopes` and `authorize` apply to it as well.
   *
   * @example
   * ```ts
   * serviceTokens: [{
   *   token: () => useRuntimeConfig().agentToken,
   *   claims: { sub: 'agent', scope: 'reports:read' },
   * }]
   * ```
   */
  serviceTokens?: McpOAuthServiceToken[]
  /**
   * When set, `authorizationServerHandler` proxies this issuer's RFC 8414
   * document. Old MCP clients look for it on the resource origin rather than
   * the issuer.
   */
  authorizationServer?: string
}

export interface McpOAuthServiceToken {
  token: string | (() => string | undefined)
  claims: McpOAuthClaims & { sub: string }
}

/**
 * JWT resource-server config with `jwt` required. Connectors return this;
 * `mcp({ oauth })` accepts it. Opaque tokens still use `createMcpOAuth({ verify })`.
 */
export type McpOAuthSetup = Omit<McpOAuthOptions, 'jwt' | 'verify'> & {
  jwt: Omit<McpOAuthJwtOptions, 'audience'> & { audience?: string | string[] }
}

/** What the metadata handlers read from a request event. */
export interface McpMetadataEvent {
  req: { method: string }
}

/**
 * Key of what the handler needs to build OAuth challenges. Kept off the public
 * shape so a request-derived `resource` can be added without changing it.
 *
 * @internal
 */
export const oauthChallenge: unique symbol = Symbol.for('nitro-mcp-toolkit.oauth-challenge')

/** @internal */
export interface McpOAuthChallenge {
  /** Absolute URL carried on every `401` `WWW-Authenticate`. */
  resourceMetadataUrl: string
  /** Scopes named in the `401` challenge (`scopesSupported`), when any are advertised. */
  scope?: string
}

export interface McpOAuth {
  /** Path to mount `metadataHandler` on, derived from `resource` per RFC 9728. */
  metadataPath: string
  /** Pass as `auth` to `createMcpHandler`. */
  auth: McpAuthOptions
  /** Serves the RFC 9728 protected resource metadata, with CORS. Nitro 2 events work too. */
  metadataHandler: (event: McpMetadataEvent) => Response
  /**
   * RFC 8414 document for this issuer, with CORS. Only set when
   * `authorizationServer` was given.
   */
  authorizationServerHandler?: (event: McpMetadataEvent) => Promise<Response>
  /** @internal */
  readonly [oauthChallenge]: McpOAuthChallenge
}

function corsResponse(body: unknown, status = 200): Response {
  const headers = new Headers(CORS)

  if (status === 204) return new Response(null, { status, headers })

  headers.set('content-type', 'application/json')
  return new Response(JSON.stringify(body), { status, headers })
}

function claimsOf(payload: JWTPayload): McpOAuthClaims {
  return { ...payload }
}

function stashClaims(event: H3Event, claims: McpOAuthClaims): void {
  event.context.oauth = claims
}

function createJwtVerifier(jwt: McpOAuthJwtOptions, resource: string, issuers: string[]) {
  const jwksUrl = assertAbsoluteHttpUrl(jwt.jwks, '`jwt.jwks`', true)
  const JWKS = createRemoteJWKSet(jwksUrl)
  const issuer = jwt.issuer ?? issuers
  const audience = jwt.audience === false ? undefined : (jwt.audience ?? resource)
  const parties = jwt.authorizedParties

  return async (token: string, event: H3Event): Promise<boolean> => {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer,
        ...(audience === undefined ? {} : { audience }),
        clockTolerance: 5,
        requiredClaims: ['exp', 'sub', ...(jwt.requiredClaims ?? [])],
        ...(jwt.typ ? { typ: jwt.typ } : {}),
      })

      if (typeof payload.sub !== 'string' || payload.sub === '' || payload.cnf !== undefined)
        return false

      if (parties) {
        if (typeof payload.azp !== 'string' || !parties.includes(payload.azp)) return false
      }

      stashClaims(event, claimsOf(payload))
      return true
    } catch (error) {
      if (error instanceof errors.JOSEError) return false
      throw error
    }
  }
}

const encoder = new TextEncoder()

// Compares every byte whatever the first difference, so timing does not reveal a prefix.
function sameToken(expected: string, actual: string): boolean {
  const a = encoder.encode(expected)
  const b = encoder.encode(actual)
  let difference = a.length ^ b.length
  for (let index = 0; index < b.length; index++) difference |= (a[index] ?? 0) ^ b[index]!
  return difference === 0
}

function matchServiceToken(
  serviceTokens: McpOAuthServiceToken[] | undefined,
  token: string,
): McpOAuthServiceToken | undefined {
  return serviceTokens?.find((entry) => {
    const expected = typeof entry.token === 'function' ? entry.token() : entry.token
    return typeof expected === 'string' && expected !== '' && sameToken(expected, token)
  })
}

// RFC 6749 scope tokens: printable ASCII without space, `"` or `\`, so they fit a quoted challenge.
const SCOPE_TOKEN = /^[\x21\x23-\x5B\x5D-\x7E]+$/

export function challengeScopes(scopes: readonly string[] | undefined): string | undefined {
  const valid = scopes?.filter((scope) => SCOPE_TOKEN.test(scope))
  return valid?.length ? valid.join(' ') : undefined
}

function normalizeIssuer(value: string, label: string): string {
  const url = assertAbsoluteHttpUrl(value, label)
  return url.href.replace(/\/+$/, '') || url.origin
}

function metadataHandlerFor(metadata: McpProtectedResourceMetadata) {
  return (event: McpMetadataEvent): Response => {
    if (event.req.method === 'OPTIONS') return corsResponse(null, 204)
    return corsResponse(metadata)
  }
}

function authorizationServerHandlerFor(issuer: string) {
  const url = authorizationServerMetadataUrl(issuer).href

  return async (event: McpMetadataEvent): Promise<Response> => {
    if (event.req.method === 'OPTIONS') return corsResponse(null, 204)

    const response = await fetch(url)

    if (!response.ok) {
      return corsResponse({ error: 'authorization_server_unavailable' }, 502)
    }

    return corsResponse(await response.json())
  }
}

/**
 * Wire this MCP endpoint as an OAuth 2.1 resource server: RFC 9728 metadata,
 * a `401` that points at it, and JWT or `verify` on every bearer token.
 *
 * This package does not issue tokens. Pair it with an authorization server,
 * or a connector under `nitro-mcp-toolkit/oauth/*` that fills the issuer
 * conventions in for you.
 */
export function createMcpOAuth(options: McpOAuthOptions): McpOAuth {
  const resource = normalizeResource(options.resource)

  const authorizationServers = options.authorizationServers.map((issuer) =>
    normalizeIssuer(issuer, '`authorizationServers` entry'),
  )

  if (authorizationServers.length === 0) {
    throw new Error('[nitro-mcp-toolkit] `authorizationServers` needs at least one issuer.')
  }

  if (!options.jwt && !options.verify) {
    throw new Error('[nitro-mcp-toolkit] `createMcpOAuth` needs `jwt` or `verify`.')
  }

  for (const entry of options.serviceTokens ?? []) {
    if (typeof entry?.claims?.sub !== 'string' || entry.claims.sub === '') {
      throw new Error('[nitro-mcp-toolkit] Each `serviceTokens` entry needs `claims.sub`.')
    }
  }

  if (options.jwt?.audience === false && !options.verify) {
    throw new Error(
      '[nitro-mcp-toolkit] Disabling audience validation requires a resource verifier in `verify`.',
    )
  }

  const verifyJwt = options.jwt
    ? createJwtVerifier(options.jwt, resource, authorizationServers)
    : undefined

  const authorizationServer = options.authorizationServer
    ? normalizeIssuer(options.authorizationServer, '`authorizationServer`')
    : undefined

  const metadataUrl = protectedResourceMetadataUrl(resource)
  const metadata: McpProtectedResourceMetadata = {
    resource,
    authorization_servers: authorizationServers,
    bearer_methods_supported: ['header'],
    ...(options.scopesSupported ? { scopes_supported: options.scopesSupported } : {}),
  }

  const auth: McpAuthOptions = {
    schemes: ['bearer'],
    resourceMetadataUrl: metadataUrl.href,
    validate: async (credential, event) => {
      delete event.context.oauth
      if (credential.scheme !== 'bearer') return false
      const service = matchServiceToken(options.serviceTokens, credential.token)
      if (service) {
        stashClaims(event, { ...service.claims })
        return true
      }
      if (verifyJwt && !(await verifyJwt(credential.token, event))) return false
      if (options.verify && !(await options.verify(credential.token, event))) return false
      return true
    },
  }

  const scope = challengeScopes(options.scopesSupported)

  return {
    metadataPath: metadataUrl.pathname,
    auth,
    metadataHandler: metadataHandlerFor(metadata),
    ...(authorizationServer
      ? { authorizationServerHandler: authorizationServerHandlerFor(authorizationServer) }
      : {}),
    [oauthChallenge]: { resourceMetadataUrl: metadataUrl.href, ...(scope ? { scope } : {}) },
  }
}

declare module 'h3' {
  interface H3EventContext {
    oauth?: McpOAuthClaims
  }
}
