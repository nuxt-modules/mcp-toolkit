import { buildContext } from './context'
import type {
  CacheHint,
  Icon,
  ReadResourceResult,
  ResourceMetadata,
  ResourceTemplate,
  ServerContext,
  Variables,
} from '@modelcontextprotocol/server'
import type { McpContext } from './context'
import type { McpResource } from './registry'

type Awaitable<T> = T | Promise<T>

/**
 * What a resource handler may return: the text of the resource, or a full
 * protocol result when it carries several contents or binary data.
 */
export type McpResourceReturn = ReadResourceResult | string

interface McpResourceMetadata {
  name: string
  title?: string
  description?: string
  mimeType?: string
  icons?: Icon[]
  /** Advertised to clients so they may cache the read. */
  cacheHint?: CacheHint
}

export interface McpResourceDefinition extends McpResourceMetadata {
  /** A concrete URI, e.g. `docs://changelog`. */
  uri: string
  handler: (uri: URL, ctx: McpContext) => Awaitable<McpResourceReturn>
}

export interface McpResourceTemplateDefinition extends McpResourceMetadata {
  /** A `ResourceTemplate` whose placeholders are resolved per read. */
  uri: ResourceTemplate
  handler: (uri: URL, variables: Variables, ctx: McpContext) => Awaitable<McpResourceReturn>
}

function toReadResult(uri: URL, value: McpResourceReturn): ReadResourceResult {
  return typeof value === 'string' ? { contents: [{ uri: uri.href, text: value }] } : value
}

// `uri` is a `string` or a class instance, neither of which is a unit type, so
// the union needs a predicate rather than an inline `typeof` check to narrow.
function isStatic(
  definition: McpResourceDefinition | McpResourceTemplateDefinition,
): definition is McpResourceDefinition {
  return typeof definition.uri === 'string'
}

/**
 * Define an MCP resource: data a client can read by URI.
 *
 * @example
 * ```ts
 * export default defineMcpResource({
 *   name: 'changelog',
 *   uri: 'docs://changelog',
 *   handler: () => readFile('CHANGELOG.md', 'utf8'),
 * })
 * ```
 */
export function defineMcpResource(definition: McpResourceDefinition): McpResource
export function defineMcpResource(definition: McpResourceTemplateDefinition): McpResource
export function defineMcpResource(
  definition: McpResourceDefinition | McpResourceTemplateDefinition,
): McpResource {
  const { name, title, description, mimeType, icons, cacheHint, uri } = definition
  const config: ResourceMetadata & { cacheHint?: CacheHint } = {
    title,
    description,
    mimeType,
    icons,
    cacheHint,
  }

  return {
    kind: 'resource',
    name,
    title,
    description,
    uri: typeof uri === 'string' ? uri : uri.uriTemplate.toString(),
    register(server) {
      if (isStatic(definition)) {
        const { uri: staticUri, handler } = definition
        server.registerResource(name, staticUri, config, async (url: URL, ctx: ServerContext) =>
          toReadResult(url, await handler(url, buildContext(ctx))),
        )
        return
      }

      const { uri: template, handler } = definition
      server.registerResource(
        name,
        template,
        config,
        async (url: URL, variables: Variables, ctx: ServerContext) =>
          toReadResult(url, await handler(url, variables, buildContext(ctx))),
      )
    },
  }
}
