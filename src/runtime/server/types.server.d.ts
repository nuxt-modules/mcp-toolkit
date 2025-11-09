import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './mcp/definitions'

declare module '#nuxt-mcp/tools.mjs' {
  export const tools: McpToolDefinition[]
}

declare module '#nuxt-mcp/resources.mjs' {
  export const resources: McpResourceDefinition[]
}

declare module '#nuxt-mcp/prompts.mjs' {
  export const prompts: McpPromptDefinition[]
}
