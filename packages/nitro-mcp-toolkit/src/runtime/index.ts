/// <reference path="./virtual.d.ts" />

export { createMcpHandler } from './handler.ts'
export { acceptedContent, inputRequired, inputResponse } from './mrtr.ts'
export { defineMcpPrompt } from './prompt.ts'
export { MODERN_PROTOCOL_VERSION } from './protocol.ts'
export { defineMcpResource } from './resource.ts'
export { audioResult, imageResult } from './results.ts'
export { defineMcpTool } from './tool.ts'

export type { McpContext } from './context.ts'
export type { McpHandler, McpHandlerOptions } from './handler.ts'
export type { McpInputResponseView } from './mrtr.ts'
export type {
  McpPromptArgumentDefinition,
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

// Re-exported so a definition file only ever imports from this entry.
export { McpJsonRpcError } from 'h3-mcp'
export type {
  McpCacheHints,
  McpCallToolResult,
  McpCompleteContext,
  McpCompleteResult,
  McpContentBlock,
  McpEra,
  McpGetPromptResult,
  McpIcon,
  McpInputRequest,
  McpInputRequests,
  McpInputRequiredResult,
  McpInputResponses,
  McpReadResourceResult,
  McpRequestContext,
  McpResourceDescriptor,
  McpToolAnnotations,
} from 'h3-mcp'
