import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './mcp/definitions'
import './types/hooks'

declare module '#nuxt-mcp-toolkit/tools.mjs' {
  export const tools: McpToolDefinition[]
}

declare module '#nuxt-mcp-toolkit/resources.mjs' {
  export const resources: McpResourceDefinition[]
}

declare module '#nuxt-mcp-toolkit/prompts.mjs' {
  export const prompts: McpPromptDefinition[]
}

declare module '#nuxt-mcp-toolkit/config.mjs' {
  import type { McpConfig } from './mcp/config'

  const config: McpConfig
  export default config
}

declare module '#nuxt-mcp-toolkit/transport.mjs' {
  import type { McpTransportHandler } from './mcp/providers/types'

  const handleMcpRequest: McpTransportHandler
  export default handleMcpRequest
}
