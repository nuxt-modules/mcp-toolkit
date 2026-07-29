import type { McpServer } from '@modelcontextprotocol/server'

/**
 * A definition as returned by the `defineMcp*` helpers: its schema generics are
 * erased so definitions can be collected in one array, while it keeps enough
 * metadata to be listed without constructing a server.
 */
export interface McpDefinition {
  readonly kind: 'tool' | 'resource' | 'prompt'
  readonly name: string
  readonly title?: string
  readonly description?: string
  /**
   * Registers this definition on the per-request SDK server instance.
   *
   * @internal
   */
  readonly register: (server: McpServer) => void
}

export interface McpTool extends McpDefinition {
  readonly kind: 'tool'
}

export interface McpResource extends McpDefinition {
  readonly kind: 'resource'
  readonly uri: string
}

export interface McpPrompt extends McpDefinition {
  readonly kind: 'prompt'
}
