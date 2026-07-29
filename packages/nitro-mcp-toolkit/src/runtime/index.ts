export { createMcpHandler } from './handler'
export { defineMcpPrompt } from './prompt'
export { MODERN_PROTOCOL_VERSION } from './protocol'
export { defineMcpResource } from './resource'
export { audioResult, imageResult } from './results'
export { defineMcpTool } from './tool'

export type { McpContext } from './context'
export type { McpHandler, McpHandlerOptions } from './handler'
export type {
  McpPromptDefinition,
  McpPromptDefinitionWithoutInput,
  McpPromptReturn,
} from './prompt'
export type {
  McpResourceDefinition,
  McpResourceReturn,
  McpResourceTemplateDefinition,
} from './resource'
export type { McpDefinition, McpPrompt, McpResource, McpTool } from './definition'
export type { McpToolValue } from './results'
export type { McpToolDefinition, McpToolDefinitionWithoutInput, McpToolReturn } from './tool'

// Re-exported so a definition file only ever imports from this entry: the
// multi-round-trip builders, the resource-template class, and the result types
// a handler may need to name.
export {
  acceptedContent,
  completable,
  inputRequired,
  inputResponse,
  ResourceTemplate,
} from '@modelcontextprotocol/server'
export type {
  AuthInfo,
  CacheHint,
  CallToolResult,
  ContentBlock,
  GetPromptResult,
  Icon,
  InputRequiredResult,
  ReadResourceResult,
  ServerNotifier,
  ToolAnnotations,
} from '@modelcontextprotocol/server'
