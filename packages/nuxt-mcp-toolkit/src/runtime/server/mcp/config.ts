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
  if (!partial) return { ...defaultMcpConfig }
  const sessions = partial.sessions
    ? { ...defaultMcpConfig.sessions, ...partial.sessions }
    : defaultMcpConfig.sessions
  return {
    enabled: partial.enabled ?? defaultMcpConfig.enabled,
    route: partial.route ?? defaultMcpConfig.route,
    browserRedirect: partial.browserRedirect ?? defaultMcpConfig.browserRedirect,
    name: partial.name ?? defaultMcpConfig.name,
    version: partial.version ?? defaultMcpConfig.version,
    dir: partial.dir ?? defaultMcpConfig.dir,
    sessions,
  }
}
