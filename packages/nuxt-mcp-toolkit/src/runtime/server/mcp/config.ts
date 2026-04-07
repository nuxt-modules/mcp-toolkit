import type { McpIcon } from './definitions/handlers'

export interface McpSessionsConfig {
  enabled: boolean
  maxDuration: number
  maxSessions: number
}

export interface McpSecurityConfig {
  /**
   * Allowed origins for Streamable HTTP requests.
   * - `undefined` (default): same-origin enforcement (compare against the request origin)
   * - `'*'`: disable origin checks (explicit opt-out)
   * - `string[]`: allow only these origins
   */
  allowedOrigins?: string[] | '*'
}

export interface McpConfig {
  enabled: boolean
  route: string
  browserRedirect: string
  name: string
  version: string
  description?: string
  instructions?: string
  icons?: McpIcon[]
  dir: string
  sessions: McpSessionsConfig
  security: McpSecurityConfig
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
    maxSessions: 1000,
  },
  security: {},
}

export function getMcpConfig(partial?: Partial<McpConfig>): McpConfig {
  if (!partial) return { ...defaultMcpConfig }
  const sessions = partial.sessions
    ? { ...defaultMcpConfig.sessions, ...partial.sessions }
    : defaultMcpConfig.sessions
  const security = partial.security
    ? { ...defaultMcpConfig.security, ...partial.security }
    : defaultMcpConfig.security
  return {
    enabled: partial.enabled ?? defaultMcpConfig.enabled,
    route: partial.route ?? defaultMcpConfig.route,
    browserRedirect: partial.browserRedirect ?? defaultMcpConfig.browserRedirect,
    name: partial.name ?? defaultMcpConfig.name,
    version: partial.version ?? defaultMcpConfig.version,
    description: partial.description,
    instructions: partial.instructions,
    icons: partial.icons,
    dir: partial.dir ?? defaultMcpConfig.dir,
    sessions,
    security,
  }
}
