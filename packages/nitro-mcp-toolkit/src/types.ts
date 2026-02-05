import type { Nitro } from 'nitropack'

export interface McpNitroModuleOptions {
  /**
   * Enable or disable the MCP server
   * @default true
   */
  enabled?: boolean
  /**
   * The route path for the MCP server endpoint
   * @default '/mcp'
   */
  route?: string
  /**
   * URL to redirect to when a browser accesses the MCP endpoint
   * @default '/'
   */
  browserRedirect?: string
  /**
   * The name of the MCP server
   * @default 'MCP Server'
   */
  name?: string
  /**
   * The version of the MCP server
   * @default '1.0.0'
   */
  version?: string
  /**
   * Base directory for MCP definitions relative to server directory
   * The module will look for tools, resources, and prompts in subdirectories
   * @default 'mcp'
   */
  dir?: string
}

export interface NitroModule {
  name?: string
  setup: (nitro: Nitro) => void | Promise<void>
}

// Re-export types from definitions
export type {
  McpToolDefinition,
  McpResourceDefinition,
  McpPromptDefinition,
  McpHandlerOptions,
  McpMiddleware,
  McpCache,
  McpCacheOptions,
  MsCacheDuration,
} from './definitions'

// Re-export types from handler
export type {
  ResolvedMcpConfig,
  CreateMcpHandlerConfig,
  McpTransportHandler,
} from './handler'

// Re-export config type
export type { McpConfig } from './config'
