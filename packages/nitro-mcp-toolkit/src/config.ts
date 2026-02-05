import { defu } from 'defu'

export interface McpConfig {
  enabled: boolean
  route: string
  browserRedirect: string
  name: string
  version: string
  dir: string
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
  return defu(partial, defaultMcpConfig)
}
