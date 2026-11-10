import { isAPIError } from 'better-auth/api'
import { verifyBearerToken } from 'better-auth/oauth2'
import { assertAbsoluteHttpUrl, normalizeResource } from '../oauth-url.ts'
import { createMcpOAuth } from '../oauth.ts'
import type { McpOAuth, McpOAuthOptions } from '../oauth.ts'

export interface BetterAuthOAuthOptions {
  resource: string
  /** The OAuth provider's exact issuer, including its auth base path. */
  issuer: string
  /** The provider's JWKS endpoint, including its auth base path. */
  jwks: string
  scopesSupported?: string[]
}

/** Better Auth OAuth provider JWT access tokens; session and proof-bound tokens are rejected. */
export function betterAuth(options: BetterAuthOAuthOptions): McpOAuthOptions & McpOAuth {
  const resource = normalizeResource(options.resource)
  assertAbsoluteHttpUrl(options.issuer, '`betterAuth.issuer`')
  assertAbsoluteHttpUrl(options.jwks, '`betterAuth.jwks`', true)

  const { issuer, jwks } = options

  const config: McpOAuthOptions = {
    resource,
    authorizationServers: [issuer],
    authorizationServer: issuer,
    ...(options.scopesSupported ? { scopesSupported: options.scopesSupported } : {}),
    verify: async (token, event) => {
      delete event.context.oauth

      try {
        const claims = await verifyBearerToken(token, {
          jwksUrl: jwks,
          verifyOptions: {
            issuer,
            audience: resource,
            typ: 'at+jwt',
            requiredClaims: ['exp', 'azp', 'sub'],
          },
        })

        // The official bearer verifier rejects cnf.jkt; other confirmation methods need proof too.
        if (
          claims.cnf !== undefined ||
          typeof claims.azp !== 'string' ||
          claims.azp === '' ||
          typeof claims.sub !== 'string' ||
          claims.sub === ''
        ) {
          return false
        }

        event.context.oauth = { ...claims }
        return true
      } catch (error) {
        if (isAPIError(error) && error.statusCode === 401) return false
        throw error
      }
    },
  }

  return Object.assign(config, createMcpOAuth(config))
}
