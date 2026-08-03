/// <reference path="./virtual.d.ts" />

export { createMcpHandler } from './handler.ts'
export { defineMcpPrompt } from './prompt.ts'
export { MODERN_PROTOCOL_VERSION } from './protocol.ts'
export { defineMcpResource } from './resource.ts'
export { audioResult, imageResult } from './results.ts'
export { defineMcpTool } from './tool.ts'

export type { McpContext } from './context.ts'
export type { McpHandler, McpHandlerOptions } from './handler.ts'
export type {
  McpPromptDefinition,
  McpPromptDefinitionWithoutInput,
  McpPromptReturn,
} from './prompt.ts'
export type {
  McpResourceDefinition,
  McpResourceReturn,
  McpResourceTemplateDefinition,
} from './resource.ts'
export type {
  McpDefinition,
  McpDefinitionSource,
  McpDefinitionSummary,
  McpIdentity,
  McpPrompt,
  McpResource,
  McpTool,
} from './definition.ts'
export type { McpOriginOptions } from './origin.ts'
export type { McpToolValue } from './results.ts'
export type { McpToolDefinition, McpToolDefinitionWithoutInput, McpToolReturn } from './tool.ts'

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
