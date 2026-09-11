import { envValue } from './env.ts'
import type { McpOAuthSetup } from '../oauth.ts'

const DEFAULT_AUTH_SERVER = 'default'

export interface OktaOAuthOptions {
  /**
   * This MCP endpoint as a resource identifier. Also the default access-token
   * `aud` — set `audience` if the Okta API uses a different identifier.
   *
   * @example 'https://api.example.com/mcp'
   */
  resource: string
  /**
   * Okta hostname, not a URL. Builds `https://{domain}/oauth2/{authorizationServerId}`.
   *
   * @example 'acme.okta.com'
   */
  domain?: string
  /**
   * Full custom authorization server issuer.
   *
   * @example 'https://acme.okta.com/oauth2/default'
   */
  issuer?: string
  /**
   * Custom authorization server id when `domain` is set.
   *
   * @default 'default'
   */
  authorizationServerId?: string
  /** Access-token `aud`. Defaults to `resource`. */
  audience?: string | string[]
  scopesSupported?: string[]
}

function issuerFromDomain(domain: string, authorizationServerId: string): string {
  const host = domain.trim()

  if (host.includes('/') || host.includes(':')) {
    throw new Error(
      '[nitro-mcp-toolkit] `okta` `domain` is a hostname (acme.okta.com). Pass `issuer` for a full authorization-server URL.',
    )
  }

  return `https://${host}/oauth2/${authorizationServerId}`
}

/**
 * Okta custom authorization server: JWKS at `{issuer}/v1/keys`, RFC 8414 at
 * the path-style well-known URL. Org authorization servers issue opaque
 * tokens — those still need `createMcpOAuth({ verify })`.
 */
export function okta(options: OktaOAuthOptions): McpOAuthSetup {
  if (options.issuer && options.domain) {
    throw new Error('[nitro-mcp-toolkit] `okta` takes `issuer` or `domain`, not both.')
  }

  const authorizationServerId = options.authorizationServerId ?? DEFAULT_AUTH_SERVER
  const fromEnvDomain = envValue(['OKTA_DOMAIN'])
  const issuer =
    options.issuer ??
    (options.domain ? issuerFromDomain(options.domain, authorizationServerId) : undefined) ??
    envValue(['OKTA_ISSUER']) ??
    (fromEnvDomain ? issuerFromDomain(fromEnvDomain, authorizationServerId) : undefined)

  if (!issuer) {
    throw new Error(
      '[nitro-mcp-toolkit] `okta` needs `issuer` or `domain`, or `OKTA_ISSUER` / `OKTA_DOMAIN`.',
    )
  }

  const normalized = issuer.replace(/\/+$/, '')

  if (!normalized.includes('/oauth2/')) {
    throw new Error(
      '[nitro-mcp-toolkit] `okta` `issuer` must be a custom authorization server (`https://{domain}/oauth2/{id}`). Org-server tokens are opaque.',
    )
  }

  return {
    resource: options.resource,
    authorizationServers: [normalized],
    jwt: {
      jwks: `${normalized}/v1/keys`,
      issuer: normalized,
      ...(options.audience !== undefined ? { audience: options.audience } : {}),
    },
    ...(options.scopesSupported ? { scopesSupported: options.scopesSupported } : {}),
    authorizationServer: normalized,
  }
}
