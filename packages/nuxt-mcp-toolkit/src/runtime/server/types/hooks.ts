// Declare module to extend Nuxt hooks
declare module '@nuxt/schema' {
  interface NuxtHooks {
    /**
     * Add additional directories to scan for MCP definition files (tools, resources, prompts, handlers).
     * @param paths - Object containing arrays of directory paths for each definition type.
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
