import type { McpToolDefinition } from './tools'
import type { McpResourceDefinition } from './resources'
import type { McpPromptDefinition } from './prompts'

export interface McpHandlerOptions {
  name: string
  version?: string
  route?: string
  browserRedirect?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<McpToolDefinition<any, any>>
  resources?: McpResourceDefinition[]
  prompts?: McpPromptDefinition[]
}

export interface McpHandlerDefinition extends Required<Omit<McpHandlerOptions, 'tools' | 'resources' | 'prompts'>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Array<McpToolDefinition<any, any>>
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
}

export function defineMcpHandler(options: McpHandlerOptions): McpHandlerOptions {
  return options
}
