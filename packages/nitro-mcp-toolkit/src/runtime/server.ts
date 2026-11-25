import { assertMcpOAuth, defineMcpAuth } from './auth.ts'
import type { McpOAuth } from './oauth.ts'
import type { McpHandlerOptions } from './handler.ts'

export type McpServerConfig = Pick<
  McpHandlerOptions,
  | 'name'
  | 'version'
  | 'title'
  | 'description'
  | 'icons'
  | 'websiteUrl'
  | 'instructions'
  | 'era'
  | 'session'
  | 'logging'
  | 'limits'
  | 'origin'
  | 'auth'
  | 'authorize'
> & { oauth?: McpOAuth }

export function defineMcpServer(config: McpServerConfig): McpServerConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new TypeError('MCP index modules must default-export server configuration.')
  }
  if (config.auth !== undefined && config.auth !== false) defineMcpAuth(config.auth)
  if (config.oauth !== undefined) assertMcpOAuth(config.oauth)
  if (config.oauth !== undefined && config.auth !== undefined)
    throw new TypeError('MCP auth and oauth cannot both be configured.')
  return config
}
