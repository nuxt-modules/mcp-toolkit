export {
  // Tool definitions
  defineMcpTool,
  registerToolFromDefinition,
  type McpToolDefinition,
  type McpToolCallback,

  // Resource definitions
  defineMcpResource,
  registerResourceFromDefinition,
  type McpResourceDefinition,

  // Prompt definitions
  defineMcpPrompt,
  registerPromptFromDefinition,
  type McpPromptDefinition,

  // Handler definitions
  defineMcpHandler,
  type McpHandlerOptions,
  type McpMiddleware,

  // Result helpers
  textResult,
  jsonResult,
  errorResult,
  imageResult,

  // Cache utilities
  type McpCache,
  type McpCacheOptions,
  type MsCacheDuration,
  createCacheOptions,
  parseCacheDuration,
  wrapWithCache,
} from 'nitro-mcp-toolkit/definitions'
