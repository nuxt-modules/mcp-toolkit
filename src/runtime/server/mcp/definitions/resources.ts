import type { McpServer, ResourceTemplate, ReadResourceCallback, ReadResourceTemplateCallback, ResourceMetadata } from '@modelcontextprotocol/sdk/server/mcp.js'
import { enrichNameTitle } from './utils'

/**
 * Definition of an MCP resource matching the SDK's registerResource signature
 * Supports both static resources (URI string) and dynamic resources (ResourceTemplate)
 */
export interface McpResourceDefinition {
  name?: string
  title?: string
  uri: string | ResourceTemplate
  metadata?: ResourceMetadata
  _meta?: Record<string, unknown>
  handler: ReadResourceCallback | ReadResourceTemplateCallback
}

/**
 * Helper function to register a resource from a McpResourceDefinition
 */
export function registerResourceFromDefinition(
  server: McpServer,
  resource: McpResourceDefinition,
) {
  const { name, title } = enrichNameTitle({
    name: resource.name,
    title: resource.title,
    _meta: resource._meta,
    type: 'resource',
  })

  const metadata = {
    ...resource.metadata,
    title: title || resource.metadata?.title,
  }

  if (typeof resource.uri === 'string') {
    return server.registerResource(
      name,
      resource.uri,
      metadata,
      resource.handler as ReadResourceCallback,
    )
  }
  else {
    return server.registerResource(
      name,
      resource.uri,
      metadata,
      resource.handler as ReadResourceTemplateCallback,
    )
  }
}

/**
 * Define an MCP resource that will be automatically registered
 *
 * This function matches the structure of server.registerResource() from the MCP SDK.
 *
 * If `name` or `title` are not provided, they will be automatically generated from the filename
 * (e.g., `list_documentation.ts` → `name: 'list-documentation'`, `title: 'List Documentation'`).
 *
 * @example
 * ```ts
 * // server/mcp/resources/my-resource.ts
 * export default defineMcpResource({
 *   name: 'readme',
 *   title: 'README',
 *   uri: 'file:///project/README.md',
 *   metadata: {
 *     description: 'Project README file',
 *     mimeType: 'text/markdown'
 *   },
 *   handler: async (uri) => {
 *     const content = await readFile(uri.pathname, 'utf-8')
 *     return {
 *       contents: [{
 *         uri: uri.toString(),
 *         mimeType: 'text/markdown',
 *         text: content
 *       }]
 *     }
 *   }
 * })
 * ```
 *
 * @example
 * ```ts
 * // Dynamic resource with template
 * import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
 *
 * export default defineMcpResource({
 *   name: 'file',
 *   title: 'File Resource',
 *   uri: new ResourceTemplate('file:///project/{path}', {
 *     list: async () => {
 *       return {
 *         resources: [
 *           { uri: 'file:///project/README.md', name: 'README.md' },
 *           { uri: 'file:///project/src/index.ts', name: 'index.ts' }
 *         ]
 *       }
 *     }
 *   }),
 *   handler: async (uri, variables) => {
 *     const path = variables.path
 *     const content = await readFile(path, 'utf-8')
 *     return {
 *       contents: [{
 *         uri: uri.toString(),
 *         mimeType: 'text/plain',
 *         text: content
 *       }]
 *     }
 *   }
 * })
 * ```
 */
export function defineMcpResource(
  definition: McpResourceDefinition,
): McpResourceDefinition {
  return definition
}
