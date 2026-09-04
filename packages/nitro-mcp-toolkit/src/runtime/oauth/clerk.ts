import { envValue } from './env.ts'
import type { McpOAuthSetup } from '../oauth.ts'

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
   * audience check. An empty list denies every token.
   */
  authorizedParties?: string[]
  scopesSupported?: string[]
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
 * Clerk issuer and JWKS with `aud` bound to the MCP resource.
 * RFC 8414 is proxied from the Frontend API so older
 * MCP clients that look on the resource origin still discover it.
 */
export function clerk(options: ClerkOAuthOptions): McpOAuthSetup {
  const key = options.publishableKey ?? envValue(CLERK_ENV)

  if (!key) {
    throw new Error(
      '[nitro-mcp-toolkit] `clerk` needs `publishableKey`, or `CLERK_PUBLISHABLE_KEY` / `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.',
    )
  }

  const issuer = `https://${frontendApiFromPublishableKey(key)}`

  return {
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
}
