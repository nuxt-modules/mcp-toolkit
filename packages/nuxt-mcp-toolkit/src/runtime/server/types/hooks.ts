// Declare module to extend Nuxt hooks
declare module '@nuxt/schema' {
  interface NuxtHooks {
    /**
     * Add additional directories to scan for MCP definition files (tools, resources, prompts, handlers).
     * @param paths - Object containing arrays of directory paths for each definition type.
     * @param paths.tools - Array of directory paths to scan for tool definitions.
     * @param paths.resources - Array of directory paths to scan for resource definitions.
     * @param paths.prompts - Array of directory paths to scan for prompt definitions.
     * @param paths.handlers - Array of directory paths to scan for handler definitions.
     * @returns void | Promise<void>
     */
    'mcp:definitions:paths': (paths: {
      tools?: string[]
      resources?: string[]
      prompts?: string[]
      handlers?: string[]
    }) => void | Promise<void>
  }
}
