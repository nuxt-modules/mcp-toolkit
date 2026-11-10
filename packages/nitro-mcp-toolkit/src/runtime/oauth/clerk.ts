import { decodeJwt } from 'jose'
import { envValue } from './env.ts'
import { createMcpOAuth } from '../oauth.ts'
import { normalizeResource } from '../oauth-url.ts'
import type { McpOAuth, McpOAuthOptions, McpOAuthSetup } from '../oauth.ts'

const KEY_PREFIX = /^pk_(test|live)_/
const CLERK_SCOPES = ['openid', 'profile', 'email']
const CLERK_ENV = ['CLERK_PUBLISHABLE_KEY', 'NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] as const

export interface ClerkOAuthOptions {
  /**
   * This MCP endpoint as a resource identifier.
   *
   * @example 'https://api.example.com/mcp'
   */
  resource: string
  /**
   * Defaults to `CLERK_PUBLISHABLE_KEY` or `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
   * Pass it explicitly from a route file on a runtime that has no `process.env`.
   */
  publishableKey?: string
  /**
   * Additional allowed `azp` values. This check does not replace the resource
   * audience check. An empty list denies every token. With a client, opaque
   * tokens are refused when this is set because Clerk does not expose their `azp`.
   */
  authorizedParties?: string[]
  scopesSupported?: string[]
}

/** Structural subset of the Clerk backend client's public request API. */
export interface ClerkOAuthClient {
  authenticateRequest(
    request: Request,
    options: {
      acceptsToken: 'oauth_token'
      audience: string
      publishableKey: string
    },
  ): Promise<{
    toAuth(): {
      isAuthenticated: boolean
      tokenType: string | null
      subject?: string | null
      userId?: string | null
      clientId?: string | null
      scopes?: string[] | null
    } | null
  }>
}

export interface ClerkRuntimeOAuthOptions extends ClerkOAuthOptions {
  /** Existing `@clerk/backend` client; OAuth audience validation needs 3.27.0 or later. */
  client: ClerkOAuthClient
}

function frontendApiFromPublishableKey(key: string): string {
  const trimmed = key.trim()

  if (!KEY_PREFIX.test(trimmed)) {
    throw new Error(
      '[nitro-mcp-toolkit] `clerk` needs a Clerk publishable key (pk_test_… or pk_live_…).',
    )
  }

  let decoded: string

  try {
    decoded = atob(trimmed.replace(KEY_PREFIX, ''))
  } catch {
    throw new Error('[nitro-mcp-toolkit] `clerk` publishable key is not valid base64.')
  }

  const host = decoded.replace(/\$$/, '')

  if (!host.includes('.')) {
    throw new Error(
      '[nitro-mcp-toolkit] `clerk` publishable key did not contain a Frontend API host.',
    )
  }

  return host
}

/**
 * Clerk issuer and JWKS, or SDK-backed OAuth verification when given a client,
 * with `aud` bound to the MCP resource.
 * RFC 8414 is proxied from the Frontend API so older
 * MCP clients that look on the resource origin still discover it.
 */
export function clerk(options: ClerkRuntimeOAuthOptions): McpOAuthOptions & McpOAuth
export function clerk(options: ClerkOAuthOptions): McpOAuthSetup & McpOAuth
export function clerk(
  options: ClerkOAuthOptions | ClerkRuntimeOAuthOptions,
): (McpOAuthSetup | McpOAuthOptions) & McpOAuth {
  const key = options.publishableKey ?? envValue(CLERK_ENV)

  if (!key) {
    throw new Error(
      '[nitro-mcp-toolkit] `clerk` needs `publishableKey`, or `CLERK_PUBLISHABLE_KEY` / `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.',
    )
  }

  const issuer = `https://${frontendApiFromPublishableKey(key)}`

  if ('client' in options) {
    const { client, authorizedParties } = options
    const resource = normalizeResource(options.resource)

    const config: McpOAuthOptions = {
      resource,
      authorizationServers: [issuer],
      scopesSupported: options.scopesSupported ?? CLERK_SCOPES,
      authorizationServer: issuer,
      verify: async (token, event) => {
        if (event.req.headers.has('dpop')) return false

        if (token.split('.').length === 3) {
          let claims
          try {
            claims = decodeJwt(token)
          } catch {
            return false
          }
          if ('cnf' in claims || claims.iss !== issuer) return false
          if (
            authorizedParties &&
            (typeof claims.azp !== 'string' || !authorizedParties.includes(claims.azp))
          )
            return false
        } else if (authorizedParties) {
          // Clerk's opaque-token auth object does not expose azp.
          return false
        }

        const headers = new Headers(event.req.headers)
        headers.set('authorization', `Bearer ${token}`)
        headers.delete('cookie')
        const state = await client.authenticateRequest(new Request(event.req.url, { headers }), {
          acceptsToken: 'oauth_token',
          audience: resource,
          publishableKey: key,
        })
        const auth = state.toAuth()

        if (
          !auth?.isAuthenticated ||
          auth.tokenType !== 'oauth_token' ||
          !auth.subject ||
          auth.userId !== auth.subject ||
          !auth.clientId ||
          !auth.scopes
        )
          return false

        event.context.oauth = {
          sub: auth.subject,
          iss: issuer,
          aud: resource,
          client_id: auth.clientId,
          scope: auth.scopes.join(' '),
        }
        return true
      },
    }
    return Object.assign(config, createMcpOAuth(config))
  }

  const config: McpOAuthSetup = {
    resource: options.resource,
    authorizationServers: [issuer],
    jwt: {
      jwks: `${issuer}/.well-known/jwks.json`,
      issuer,
      ...(options.authorizedParties ? { authorizedParties: options.authorizedParties } : {}),
    },
    scopesSupported: options.scopesSupported ?? CLERK_SCOPES,
    authorizationServer: issuer,
  }
  return Object.assign(config, createMcpOAuth(config))
}
