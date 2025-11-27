import type { McpServer, ResourceTemplate, ReadResourceCallback, ReadResourceTemplateCallback, ResourceMetadata } from '@modelcontextprotocol/sdk/server/mcp.js'
import { readFile } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { enrichNameTitle } from './utils'

/**
 * Annotations for a resource
 * @see https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations
 */
export interface McpResourceAnnotations {
  audience?: ('user' | 'assistant')[]
  priority?: number
  lastModified?: string
  [key: string]: unknown
}

/**
 * Definition of a standard MCP resource (with URI and handler)
 */
export interface StandardMcpResourceDefinition {
  name?: string
  title?: string
  description?: string
  uri: string | ResourceTemplate
  metadata?: ResourceMetadata & { annotations?: McpResourceAnnotations }
  _meta?: Record<string, unknown>
  handler: ReadResourceCallback | ReadResourceTemplateCallback
  file?: never
}

/**
 * Definition of a file-based MCP resource
 */
export interface FileMcpResourceDefinition {
  name?: string
  title?: string
  description?: string
  uri?: string
  metadata?: ResourceMetadata & { annotations?: McpResourceAnnotations }
  _meta?: Record<string, unknown>
  handler?: ReadResourceCallback
  /**
   * Path to the local file to serve as a resource
   * Relative to the project root
   */
  file: string
}

/**
 * Definition of an MCP resource matching the SDK's registerResource signature
 * Supports both static resources (URI string), dynamic resources (ResourceTemplate),
 * and local file resources.
 */
export type McpResourceDefinition = StandardMcpResourceDefinition | FileMcpResourceDefinition

/**
 * Helper function to get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.md': return 'text/markdown'
    case '.ts':
    case '.mts':
    case '.cts': return 'text/typescript'
    case '.js':
    case '.mjs':
    case '.cjs': return 'text/javascript'
    case '.json': return 'application/json'
    case '.html': return 'text/html'
    case '.css': return 'text/css'
    case '.xml': return 'text/xml'
    case '.csv': return 'text/csv'
    case '.yaml':
    case '.yml': return 'text/yaml'
    default: return 'text/plain'
  }
}

/**
 * Register a resource from a McpResourceDefinition
 * @internal
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

  let uri = resource.uri
  let handler = resource.handler
  const metadata = {
    ...resource.metadata,
    title: resource.title || resource.metadata?.title || title,
    description: resource.description || resource.metadata?.description,
  }

  // Handle file-based resources
  if ('file' in resource && resource.file) {
    const filePath = resolve(process.cwd(), resource.file)

    // Auto-generate URI if not provided
    if (!uri) {
      uri = pathToFileURL(filePath).toString()
    }

    // Auto-generate handler if not provided
    if (!handler) {
      handler = async (requestUri: URL) => {
        try {
          const content = await readFile(filePath, 'utf-8')
          return {
            contents: [{
              uri: requestUri.toString(),
              mimeType: resource.metadata?.mimeType || getMimeType(filePath),
              text: content,
            }],
          }
        }
        catch (error) {
          // Return error as content or throw depending on preference
          // Throwing will return an error result to the client
          throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  if (!uri) {
    throw new Error(`Resource ${name} is missing a URI`)
  }

  if (!handler) {
    throw new Error(`Resource ${name} is missing a handler`)
  }

  if (typeof uri === 'string') {
    return server.registerResource(
      name,
      uri,
      metadata,
      handler as ReadResourceCallback,
    )
  }
  else {
    return server.registerResource(
      name,
      uri,
      metadata,
      handler as ReadResourceTemplateCallback,
    )
  }
}

/**
 * Define an MCP resource that will be automatically registered.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/resources
 *
 * @example
 * ```ts
 * // File-based resource
 * export default defineMcpResource({
 *   description: 'Project README file',
 *   file: 'README.md'
 * })
 * ```
 */
export function defineMcpResource(
  definition: McpResourceDefinition,
): McpResourceDefinition {
  return definition
}
