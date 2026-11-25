/// <reference path="./virtual.d.ts" />

export { createMcpHandler } from './handler.ts'
export { defineMcpServer } from './server.ts'
export type { McpServerConfig } from './server.ts'
export { defineMcpAuth } from './auth.ts'
export type { McpAuthCredentials, McpAuthOptions, McpAuthScheme } from './auth.ts'
export {
  createMcpOAuth,
  authorizationServerMetadataUrl,
  protectedResourceMetadataUrl,
} from './oauth.ts'
export { defineMcpPlugins } from './plugins.ts'
export { defineMcpPrompt } from './prompt.ts'
export { MODERN_PROTOCOL_VERSION } from './protocol.ts'
export { defineMcpResource } from './resource.ts'
export { audioResult, imageResult, toolResult } from './results.ts'
export { defineMcpTool } from './tool.ts'
export {
  canRequestInput,
  defineRequestState,
  getElicitedContent,
  getInputResponses,
  getMissingInputs,
  getSupportedInputs,
  inputRequired,
} from './input.ts'
export { mcpElicit, mcpElicitUrl, McpJsonRpcError } from 'h3-mcp'

export type { McpEvent, McpNotifier, McpRequestContext } from './context.ts'
export type {
  McpEra,
  McpHandler,
  McpHandlerOptions,
  McpHandlerSetup,
  McpLimitsOptions,
  McpOriginOptions,
  McpSessionOptions,
} from './handler.ts'
export type { McpExtensionPlugin } from './plugins.ts'
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
  McpCacheHints,
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
export type { McpToolResult, McpToolValue } from './results.ts'
export type {
  McpToolCall,
  McpToolCallListener,
  McpToolDefinition,
  McpToolDefinitionWithoutInput,
  McpToolReturn,
} from './tool.ts'

export type {
  CallToolResult,
  ContentBlock,
  EmbeddedResource,
  GetPromptResult,
  Icon,
  InputRequiredResult,
  ReadResourceResult,
  ResourceLink,
  StandardTypedV1,
  ToolAnnotations,
} from 'h3-mcp'
