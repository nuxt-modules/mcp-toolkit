import type { McpToolDefinition } from './utils/mcp'

declare module '#nuxt-mcp/tools.mjs' {
  export const tools: McpToolDefinition[]
}
