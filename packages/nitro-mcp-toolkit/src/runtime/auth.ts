import type { AuthOptions } from 'h3-mcp'

/** Type runtime auth modules and refuse an invalid export before serving requests. */
export function defineMcpAuth(auth: AuthOptions): AuthOptions {
  if (!auth || typeof auth !== 'object') {
    throw new TypeError('MCP auth modules must default-export authentication options.')
  }

  return auth
}
