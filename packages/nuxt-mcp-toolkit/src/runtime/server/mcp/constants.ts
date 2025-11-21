/**
 * Constants used throughout the MCP module
 */

/**
 * Default route paths for MCP endpoints
 */
export const ROUTES = {
  DEFAULT: '/mcp',
  CUSTOM_HANDLER: '/mcp/:handler',
} as const

/**
 * Subdirectory names for MCP definitions
 */
export const SUBDIRECTORIES = {
  TOOLS: 'tools',
  RESOURCES: 'resources',
  PROMPTS: 'prompts',
} as const

/**
 * Supported file extensions for MCP definition files
 */
export const FILE_EXTENSIONS = ['ts', 'js', 'mts', 'mjs'] as const
