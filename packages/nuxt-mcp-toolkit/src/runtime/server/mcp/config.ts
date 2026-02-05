import { defu } from 'defu'
import { defaultMcpConfig as baseDefaultConfig, getMcpConfig as baseGetMcpConfig, type McpConfig as BaseMcpConfig } from 'nitro-mcp-toolkit'

// Nuxt-specific config extends base config with 'enabled' field
export interface McpConfig extends BaseMcpConfig {
  enabled: boolean
}

export const defaultMcpConfig: McpConfig = {
  ...baseDefaultConfig,
  enabled: true,
}

export function getMcpConfig(partial?: Partial<McpConfig>): McpConfig {
  return defu(partial, defaultMcpConfig)
}

// Re-export base types for convenience
export type { BaseMcpConfig }
