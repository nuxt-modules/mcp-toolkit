import { defineResourceTemplate } from 'h3-mcp'
import { attachNotify } from './context.ts'
import { requireScopes } from './scopes.ts'
import { resolveMeta } from './validate.ts'
import type { H3Event } from 'h3'
import type {
  CacheHints,
  CompleteCallback,
  Icon,
  ReadResourceResult,
  ResourceDescriptor,
  ResourceTemplateListCallback,
} from 'h3-mcp'
import type { McpEvent } from './context.ts'
import type { McpResource } from './definition.ts'

type Awaitable<T> = T | Promise<T>

/**
 * What a resource handler may return: the text of the resource, or a full
 * protocol result when it carries several contents or binary data.
 */
export type McpResourceReturn = ReadResourceResult | string

interface McpResourceMetadata {
  /** Derived from the filename when discovered. */
  name?: string
  title?: string
  description?: string
  /** Inferred from the subdirectory when discovered, e.g. `resources/docs/*`. */
  group?: string
  /** Free-form labels, advertised in `_meta` for clients to filter on. */
  tags?: string[]
  /**
   * OAuth scopes required by reads, enumeration and completion callbacks.
   * Static definition metadata remains visible.
   */
  scopes?: string[]
  mimeType?: string
  icons?: Icon[]
  /** Advertised to clients so they may cache the read. */
  cache?: CacheHints
}

export interface McpResourceDefinition extends McpResourceMetadata {
  /** A concrete URI, e.g. `docs://changelog`. */
  uri: string
  handler: (uri: URL, event: McpEvent) => Awaitable<McpResourceReturn>
}

export interface McpResourceTemplateDefinition extends McpResourceMetadata {
  /** An RFC 6570 URI template, e.g. `docs://{slug}`. */
  uriTemplate: string
  /** Enumerate current members into `resources/list`. */
  list?: ResourceTemplateListCallback
  /** Autocomplete a template variable. */
  complete?: CompleteCallback
  handler: (
    uri: URL,
    variables: Record<string, string>,
    event: McpEvent,
  ) => Awaitable<McpResourceReturn>
}

function toReadResult(uri: URL, value: McpResourceReturn): ReadResourceResult {
  return typeof value === 'string' ? { contents: [{ uri: uri.href, text: value }] } : value
}

function isStatic(
  definition: McpResourceDefinition | McpResourceTemplateDefinition,
): definition is McpResourceDefinition {
  return 'uri' in definition
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
  const { name, title, description, group, tags, scopes, mimeType, icons, cache } = definition
  const isStaticUri = isStatic(definition)

  return {
    kind: 'resource',
    name,
    title,
    description,
    group,
    tags,
    scopes,
    uri: isStaticUri ? definition.uri : definition.uriTemplate,
    build(identity, into, notify) {
      const advertised = {
        name: identity.name,
        title: identity.title,
        description,
        mimeType,
        icons,
        cache,
        _meta: resolveMeta(identity.group, tags, scopes),
      }

      if (isStaticUri) {
        const { uri: staticUri, handler } = definition
        into.resources.push({
          ...advertised,
          uri: staticUri,
          handler: async (url: URL, event: H3Event) => {
            requireScopes(event, scopes, 'resource', identity.name)
            return toReadResult(url, await handler(url, attachNotify(event, notify)))
          },
        })
        return
      }

      const { uriTemplate, list, complete, handler } = definition
      into.resourceTemplates.push(
        defineResourceTemplate({
          ...advertised,
          name: identity.name,
          uriTemplate,
          list:
            list &&
            ((event) => {
              requireScopes(event, scopes, 'resource', identity.name)
              return list(event)
            }),
          complete:
            complete &&
            ((context, event) => {
              requireScopes(event, scopes, 'resource', identity.name)
              return complete(context, event)
            }),
          handler: async (url: URL, variables: Record<string, string>, event: H3Event) => {
            requireScopes(event, scopes, 'resource', identity.name)
            return toReadResult(url, await handler(url, variables, attachNotify(event, notify)))
          },
        }),
      )
    },
  }
}

export type { ResourceDescriptor }
