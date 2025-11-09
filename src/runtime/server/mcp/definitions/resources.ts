import type { McpServer, ResourceTemplate, ReadResourceCallback, ReadResourceTemplateCallback, ResourceMetadata } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Definition of an MCP resource matching the SDK's registerResource signature
 * Supports both static resources (URI string) and dynamic resources (ResourceTemplate)
 */
export interface McpResourceDefinition {
  name: string
  title?: string
  uriOrTemplate: string | ResourceTemplate
  metadata?: ResourceMetadata
  handler: ReadResourceCallback | ReadResourceTemplateCallback
}

/**
 * Helper function to register a resource from a McpResourceDefinition
 */
export function registerResourceFromDefinition(
  server: McpServer,
  resource: McpResourceDefinition,
) {
  if (typeof resource.uriOrTemplate === 'string') {
    return server.registerResource(
      resource.name,
      resource.uriOrTemplate,
      resource.metadata || {},
      resource.handler as ReadResourceCallback,
    )
  }
  else {
    return server.registerResource(
      resource.name,
      resource.uriOrTemplate,
      resource.metadata || {},
      resource.handler as ReadResourceTemplateCallback,
    )
  }
}

/**
 * Define an MCP resource that will be automatically registered
 *
 * This function matches the structure of server.registerResource() from the MCP SDK.
 *
 * @example
 * ```ts
 * // server/mcp/resources/my-resource.ts
 * export default defineMcpResource({
 *   name: 'readme',
 *   title: 'README',
 *   uriOrTemplate: 'file:///project/README.md',
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
 *   uriOrTemplate: new ResourceTemplate('file:///project/{path}', {
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
