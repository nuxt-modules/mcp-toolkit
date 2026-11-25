import type { H3Event } from 'h3/generic'
import type { McpOAuth } from './oauth.ts'

export type McpAuthScheme = 'bearer' | 'api-key'

/** The credential a request presented, as `validate` receives it. */
export interface McpAuthCredentials {
  scheme: McpAuthScheme
  token: string
}

/** Bearer token or API key authentication for an endpoint. */
export interface McpAuthOptions {
  /** @default true */
  enabled?: boolean
  /** @default ['bearer'] */
  schemes?: McpAuthScheme[]
  /** Static tokens accepted as-is. */
  tokens?: string[]
  /** Return `true` to accept the credential. Runs when no static token matched. */
  validate?: (credentials: McpAuthCredentials, event: H3Event) => boolean | Promise<boolean>
  /** Header carrying an API key. */
  header?: string
  /** RFC 9728 metadata URL carried on the `401` challenge. */
  resourceMetadataUrl?: string
}

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
export function defineMcpAuth(auth: McpAuthOptions): McpAuthOptions {
  if (!auth || typeof auth !== 'object') {
    throw new TypeError('MCP auth modules must default-export authentication options.')
  }

  return auth
}
