import { envValue } from './env.ts'
import type { McpOAuthSetup } from '../oauth.ts'

const ISSUER = 'https://api.workos.com'

export interface WorkOSOAuthOptions {
  /**
   * This MCP endpoint as a resource identifier.
   *
   * @example 'https://api.example.com/mcp'
   */
  resource: string
  /**
   * WorkOS client id. Defaults to `WORKOS_CLIENT_ID`. Access-token `aud` is
   * this client, not `resource`.
   *
   * @example 'client_123456789'
   */
  clientId?: string
  scopesSupported?: string[]
}

/**
 * WorkOS AuthKit session tokens: JWKS at `/sso/jwks/{clientId}`, `iss` is
 * `https://api.workos.com`, `aud` is the client id.
 */
export function workos(options: WorkOSOAuthOptions): McpOAuthSetup {
  const clientId = options.clientId ?? envValue(['WORKOS_CLIENT_ID'])

  if (!clientId) {
    throw new Error('[nitro-mcp-toolkit] `workos` needs `clientId`, or `WORKOS_CLIENT_ID`.')
  }

  return {
    resource: options.resource,
    authorizationServers: [ISSUER],
    jwt: {
      jwks: `${ISSUER}/sso/jwks/${clientId}`,
      issuer: ISSUER,
      audience: clientId,
    },
    ...(options.scopesSupported ? { scopesSupported: options.scopesSupported } : {}),
  }
}
