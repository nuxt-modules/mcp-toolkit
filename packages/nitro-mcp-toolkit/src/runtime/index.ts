/// <reference path="./virtual.d.ts" />

export { createMcpHandler } from './handler.ts'
export { defineMcpPrompt } from './prompt.ts'
export { MODERN_PROTOCOL_VERSION } from './protocol.ts'
export { defineMcpResource } from './resource.ts'
export { audioResult, imageResult } from './results.ts'
export { defineMcpTool } from './tool.ts'
export { getElicitedContent, inputRequired, mcpElicit, mcpElicitUrl } from './mrtr.ts'

export type { McpEvent, McpNotifier } from './context.ts'
export type { McpHandler, McpHandlerOptions, McpAuthOptions } from './handler.ts'
export type {
  McpPromptDefinition,
  McpPromptDefinitionWithArguments,
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
export type { McpToolValue } from './results.ts'
export type { McpToolDefinition, McpToolDefinitionWithoutInput, McpToolReturn } from './tool.ts'

export type {
  McpAuthCredentials,
  McpAuthScheme,
  McpCallToolResult as CallToolResult,
  McpContentBlock as ContentBlock,
  McpGetPromptResult as GetPromptResult,
  McpIcon as Icon,
  McpInputRequiredResult as InputRequiredResult,
  McpOriginOptions,
  McpReadResourceResult as ReadResourceResult,
  McpToolAnnotations as ToolAnnotations,
  McpCacheHints as CacheHint,
} from 'h3-mcp'
