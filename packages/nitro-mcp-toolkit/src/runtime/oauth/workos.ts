import { envValue } from './env.ts'
import { assertAbsoluteHttpUrl } from '../oauth-url.ts'
import { createMcpOAuth } from '../oauth.ts'
import type { McpOAuth, McpOAuthSetup } from '../oauth.ts'

export interface WorkOSOAuthOptions {
  /** The MCP URL configured as a Resource Indicator in WorkOS. */
  resource: string
  /** AuthKit issuer URL. Defaults to `WORKOS_AUTHKIT_ISSUER`. */
  issuer?: string
  scopesSupported?: string[]
}

/** WorkOS Connect access tokens bound to this MCP resource. */
export function workos(options: WorkOSOAuthOptions): McpOAuthSetup & McpOAuth {
  const value = options.issuer ?? envValue(['WORKOS_AUTHKIT_ISSUER'])
  if (!value) {
    throw new Error('[nitro-mcp-toolkit] `workos` needs `issuer`, or `WORKOS_AUTHKIT_ISSUER`.')
  }
  const issuer = assertAbsoluteHttpUrl(value, '`workos.issuer`').href.replace(/\/+$/, '')
  const setup: McpOAuthSetup = {
    resource: options.resource,
    authorizationServers: [issuer],
    jwt: {
      jwks: `${issuer}/oauth2/jwks`,
      issuer,
    },
    authorizationServer: issuer,
    ...(options.scopesSupported ? { scopesSupported: options.scopesSupported } : {}),
  }
  return Object.assign(setup, createMcpOAuth(setup))
}
