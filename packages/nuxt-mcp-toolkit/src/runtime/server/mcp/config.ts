import { defu } from 'defu'

export interface McpSessionsConfig {
  enabled: boolean
  maxDuration: number
}

export interface McpConfig {
  enabled: boolean
  route: string
  browserRedirect: string
  name: string
  version: string
  dir: string
  sessions: McpSessionsConfig
}

export const defaultMcpConfig: McpConfig = {
  enabled: true,
  route: '/mcp',
  browserRedirect: '/',
  name: '',
  version: '1.0.0',
  dir: 'mcp',
  sessions: {
    enabled: false,
    maxDuration: 30 * 60 * 1000, // 30 minutes
  },
}

export function getMcpConfig(partial?: Partial<McpConfig>): McpConfig {
  return defu(partial, defaultMcpConfig)
}
