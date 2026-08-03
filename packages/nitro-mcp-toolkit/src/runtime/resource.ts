import { buildContext } from './context.ts'
import { toCompleteResult } from './results.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type {
  McpCacheHints,
  McpCompleteContext,
  McpCompleteResult,
  McpIcon,
  McpReadResourceResult,
  McpResourceDescriptor,
} from 'h3-mcp'
import type { McpContext } from './context.ts'
import type { McpResource } from './definition.ts'

type Awaitable<T> = T | Promise<T>

/**
 * What a resource handler may return: the text of the resource, or a full
 * protocol result when it carries several contents or binary data.
 */
export type McpResourceReturn = McpReadResourceResult | string

interface McpResourceMetadata {
  /** Derived from the filename when discovered. */
  name?: string
  title?: string
  description?: string
  /** Inferred from the subdirectory when discovered, e.g. `resources/docs/*`. */
  group?: string
  /** Free-form labels, advertised in `_meta` for clients to filter on. */
  tags?: string[]
  mimeType?: string
  icons?: McpIcon[]
  /** Advertised to clients so they may cache the read. */
  cache?: McpCacheHints
}

export interface McpResourceDefinition extends McpResourceMetadata {
  /** A concrete URI, e.g. `docs://changelog`. */
  uri: string
  /** Size in bytes, when known. */
  size?: number
  handler: (uri: URL, ctx: McpContext) => Awaitable<McpResourceReturn>
}

export interface McpResourceTemplateDefinition extends McpResourceMetadata {
  /** An RFC 6570 pattern whose placeholders are resolved per read. */
  uriTemplate: string
  /**
   * The members this pattern currently expands to, for `resources/list`. Omit
   * it when the family cannot be enumerated: the pattern is then discoverable
   * through `resources/templates/list` alone.
   */
  list?: (ctx: McpContext) => Awaitable<McpResourceDescriptor[] | undefined>
  /** Completions for a placeholder, as the client types it. */
  complete?: (
    completing: McpCompleteContext,
    ctx: McpContext,
  ) => Awaitable<McpCompleteResult | string[]>
  handler: (
    uri: URL,
    variables: Record<string, string>,
    ctx: McpContext,
  ) => Awaitable<McpResourceReturn>
}

function toReadResult(uri: URL, value: McpResourceReturn): McpReadResourceResult {
  return typeof value === 'string' ? { contents: [{ uri: uri.href, text: value }] } : value
}

function isTemplate(
  definition: McpResourceDefinition | McpResourceTemplateDefinition,
): definition is McpResourceTemplateDefinition {
  return 'uriTemplate' in definition
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
 *
 * @example A family of URIs, read through one handler.
 * ```ts
 * export default defineMcpResource({
 *   uriTemplate: 'docs://{slug}',
 *   list: () => pages.map((slug) => ({ name: slug, uri: `docs://${slug}` })),
 *   handler: (uri, { slug }) => renderPage(slug),
 * })
 * ```
 */
export function defineMcpResource(definition: McpResourceDefinition): McpResource
export function defineMcpResource(definition: McpResourceTemplateDefinition): McpResource
export function defineMcpResource(
  definition: McpResourceDefinition | McpResourceTemplateDefinition,
): McpResource {
  const { name, title, description, group, tags, mimeType, icons, cache } = definition
  const templated = isTemplate(definition)

  return {
    kind: 'resource',
    name,
    title,
    description,
    group,
    tags,
    uri: templated ? definition.uriTemplate : definition.uri,
    build(identity, into) {
      const advertised = {
        name: identity.name,
        title: identity.title,
        description,
        mimeType,
        icons,
        cache,
        _meta: resolveMeta(identity.group, tags),
      }

      if (!templated) {
        const { uri, size, handler } = definition
        into.resources.push({
          ...advertised,
          uri,
          size,
          handler: async (url: URL, event: H3Event) =>
            toReadResult(url, await handler(url, buildContext(event))),
        })
        return
      }

      const { uriTemplate, list, complete, handler } = definition
      into.resourceTemplates.push({
        ...advertised,
        uriTemplate,
        ...(list ? { list: (event: H3Event) => list(buildContext(event)) } : {}),
        ...(complete
          ? {
              complete: async (completing: McpCompleteContext, event: H3Event) =>
                toCompleteResult(await complete(completing, buildContext(event))),
            }
          : {}),
        handler: async (url: URL, variables: Record<string, string>, event: H3Event) =>
          toReadResult(url, await handler(url, variables, buildContext(event))),
      })
    },
  }
}
