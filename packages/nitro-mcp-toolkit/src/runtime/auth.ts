import type { AuthOptions } from 'h3-mcp'
import type { McpOAuth } from './oauth.ts'

export function assertMcpOAuth(oauth: McpOAuth): void {
  if (
    !oauth ||
    typeof oauth.auth?.validate !== 'function' ||
    oauth.auth.enabled === false ||
    !oauth.auth.schemes?.includes('bearer') ||
    typeof oauth.metadataHandler !== 'function'
  ) {
    throw new TypeError('MCP oauth must be created with createMcpOAuth or a provider adapter.')
  }
}

/** Type runtime auth modules and refuse an invalid export before serving requests. */
export function defineMcpAuth(auth: AuthOptions): AuthOptions {
  if (!auth || typeof auth !== 'object') {
    throw new TypeError('MCP auth modules must default-export authentication options.')
  }

  return auth
}
