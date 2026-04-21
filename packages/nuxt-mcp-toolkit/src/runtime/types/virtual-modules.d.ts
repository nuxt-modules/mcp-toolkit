/**
 * Ambient declarations for the `#nuxt-mcp-toolkit/*` virtual modules
 * generated at build time by the module.
 *
 * Single source of truth: shipped to consumers via `prepare:types`
 * and picked up by the package's own typecheck.
 *
 * Note: must remain a "script" file (no top-level imports/exports) so
 * that `declare module` blocks are picked up globally without requiring
 * an import.
 */

declare module '#nuxt-mcp-toolkit/config.mjs' {
  import type { McpConfig } from '../server/mcp/config'

  const config: McpConfig
  export default config
}

declare module '#nuxt-mcp-toolkit/tools.mjs' {
  import type { McpToolDefinitionListItem } from '../server/mcp/definitions/tools'

  export const tools: McpToolDefinitionListItem[]
}

declare module '#nuxt-mcp-toolkit/resources.mjs' {
  import type { McpResourceDefinition } from '../server/mcp/definitions/resources'

  export const resources: McpResourceDefinition[]
}

declare module '#nuxt-mcp-toolkit/prompts.mjs' {
  import type { McpPromptDefinition } from '../server/mcp/definitions/prompts'

  export const prompts: McpPromptDefinition[]
}

declare module '#nuxt-mcp-toolkit/handlers.mjs' {
  import type { McpHandlerOptions } from '../server/mcp/definitions/handlers'

  export const handlers: McpHandlerOptions[]
}

declare module '#nuxt-mcp-toolkit/default-handler.mjs' {
  import type { McpHandlerOptions } from '../server/mcp/definitions/handlers'

  export const defaultHandler: McpHandlerOptions | null
}

declare module '#nuxt-mcp-toolkit/transport.mjs' {
  import type { McpTransportHandler } from '../server/mcp/providers/types'

  const handleMcpRequest: McpTransportHandler
  export default handleMcpRequest
}
