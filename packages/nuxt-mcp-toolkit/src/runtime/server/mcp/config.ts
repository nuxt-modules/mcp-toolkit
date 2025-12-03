import { defu } from 'defu'
import type { McpOAuthConfig } from './oauth/types'

export interface McpConfig {
  enabled: boolean
  route: string
  browserRedirect: string
  name: string
  version: string
  dir: string
  oauth?: McpOAuthConfig
}

export const defaultMcpConfig: McpConfig = {
  enabled: true,
  route: '/mcp',
  browserRedirect: '/',
  name: '',
  version: '1.0.0',
  dir: 'mcp',
}

export function getMcpConfig(partial?: Partial<McpConfig>): McpConfig {
  const config = defu(partial, defaultMcpConfig)
  // Ensure oauth is undefined instead of null
  if (config.oauth === null) {
    config.oauth = undefined
  }
  return config as McpConfig
}
