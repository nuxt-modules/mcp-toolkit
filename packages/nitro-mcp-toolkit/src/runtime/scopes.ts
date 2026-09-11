import { McpJsonRpcError } from 'h3-mcp'
import type { H3Event } from 'h3'
import type { McpDefinition } from './definition.ts'
import type { McpOAuthClaims } from './oauth.ts'

/**
 * Implementation-defined server error, from JSON-RPC 2.0's `-32000`…`-32099`
 * range. The `403` rides along as `status`, which is what RFC 6750 calls for.
 */
const INSUFFICIENT_SCOPE = -32003

function spaceDelimited(value: unknown): string[] {
  return typeof value === 'string' ? value.split(' ').filter((scope) => scope !== '') : []
}

/**
 * The scopes a verified access token carries: `scope` as RFC 6749 writes it,
 * space-delimited, plus `scp` — the same thing under Okta and Entra ID, which
 * may send it as an array.
 */
export function grantedScopes(claims: McpOAuthClaims | undefined): Set<string> {
  if (!claims) return new Set()

  const scp = Array.isArray(claims.scp)
    ? claims.scp.filter((scope): scope is string => typeof scope === 'string')
    : spaceDelimited(claims.scp)

  return new Set([...spaceDelimited(claims.scope), ...scp])
}

/**
 * Refuse the call when the token lacks any scope the definition declares.
 *
 * This runs at call time rather than filtering the listings: the engine
 * resolves a handler's options before it authenticates, so no listing can see
 * the claims. It fails closed — a definition declaring scopes on an endpoint
 * with no OAuth has nothing to satisfy it.
 */
export function requireScopes(
  event: H3Event,
  scopes: string[] | undefined,
  kind: McpDefinition['kind'],
  name: string,
): void {
  if (!scopes?.length) return

  const granted = grantedScopes(event.context.oauth)
  const missing = scopes.filter((scope) => !granted.has(scope))

  if (missing.length === 0) return

  throw new McpJsonRpcError(
    INSUFFICIENT_SCOPE,
    `The ${kind} ${JSON.stringify(name)} requires ${missing.join(', ')}.`,
    { status: 403, data: { requiredScopes: scopes, missingScopes: missing } },
  )
}
