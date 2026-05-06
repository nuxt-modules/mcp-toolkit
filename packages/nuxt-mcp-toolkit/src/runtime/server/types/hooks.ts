import type { H3Event } from 'h3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpResolvedConfig } from '../mcp/utils'

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

/**
 * Per-request MCP runtime hooks. Listener errors are caught and logged —
 * the request always proceeds.
 * @see https://mcp-toolkit.nuxt.dev/advanced/hooks#runtime-hooks
 */
declare module 'nitropack/types' {
  interface NitroRuntimeHooks {
    /**
     * Fires once the per-request config is resolved, before the `McpServer` is built. Mutate `ctx.config` to add or filter definitions for this request.
     * @example
     * ```ts
     * nitroApp.hooks.hook('mcp:config:resolved', ({ config, event }) => {
     *   if (!event.context.user) config.tools = config.tools.filter(t => !t.tags?.includes('admin'))
     * })
     * ```
     */
    'mcp:config:resolved': (ctx: {
      config: McpResolvedConfig
      event: H3Event
    }) => void | Promise<void>
    /**
     * Fires after the per-request `McpServer` is built, before transport. Register late definitions or reach the SDK via `getSdkServer(ctx.server)`.
     * @example
     * ```ts
     * nitroApp.hooks.hook('mcp:server:created', ({ server }) => {
     *   server.registerTool('whoami', { description: '...' }, async () => 'me')
     * })
     * ```
     */
    'mcp:server:created': (ctx: {
      server: McpServer
      event: H3Event
    }) => void | Promise<void>
  }
}
