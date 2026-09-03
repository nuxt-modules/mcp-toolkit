/// <reference path="./virtual.d.ts" />

export { createMcpHandler } from './handler.ts'
export {
  createMcpOAuth,
  authorizationServerMetadataUrl,
  protectedResourceMetadataUrl,
} from './oauth.ts'
export { defineMcpPrompt } from './prompt.ts'
export { MODERN_PROTOCOL_VERSION } from './protocol.ts'
export { defineMcpResource } from './resource.ts'
export { audioResult, imageResult } from './results.ts'
export { defineMcpTool } from './tool.ts'
export {
  canRequestInput,
  defineRequestState,
  getElicitedContent,
  getInputResponses,
  getMissingInputs,
  getSupportedInputs,
  inputRequired,
  mcpElicit,
  mcpElicitUrl,
  McpJsonRpcError,
} from 'h3-mcp'

export type { McpEvent, McpNotifier } from './context.ts'
export type { McpHandler, McpHandlerOptions } from './handler.ts'
export type {
  McpOAuth,
  McpOAuthClaims,
  McpOAuthJwtOptions,
  McpOAuthOptions,
  McpOAuthSetup,
  McpProtectedResourceMetadata,
} from './oauth.ts'
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
  AuthCredentials,
  AuthOptions,
  AuthScheme,
  CacheHints,
  CallToolResult,
  ContentBlock,
  Era,
  ExtensionPlugin,
  GetPromptResult,
  Icon,
  InputRequiredResult,
  OriginOptions,
  PluginOptions,
  ReadResourceResult,
  ToolAnnotations,
} from 'h3-mcp'
