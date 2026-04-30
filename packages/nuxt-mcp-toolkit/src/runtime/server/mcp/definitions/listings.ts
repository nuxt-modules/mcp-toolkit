import type { H3Event } from 'h3'
import type { McpPromptDefinition } from './prompts'
import type { McpResourceDefinition } from './resources'
import type { McpToolDefinitionListItem } from './tools'
import { enrichNameTitle } from './utils'

/**
 * Common fields shared by tool/resource/prompt summaries.
 *
 * These shapes are JSON-serializable on purpose — they are intended
 * to be returned from server routes (`/.well-known/mcp/server-card.json`,
 * sitemaps, admin dashboards) without leaking handlers or SDK internals.
 */
interface BaseMcpSummary {
  name: string
  title?: string
  description?: string
  group?: string
  tags?: string[]
  /**
   * Named handler this definition is attributed to via folder convention
   * (file lives under `server/mcp/handlers/<name>/{tools,resources,prompts}/`).
   *
   * Omitted for orphan definitions (only attached to the default handler).
   */
  handler?: string
}

/** Lightweight summary of an MCP tool definition. */
export type McpToolSummary = BaseMcpSummary

/** Lightweight summary of an MCP resource definition. */
export interface McpResourceSummary extends BaseMcpSummary {
  /**
   * URI of the resource. For static resources this is the URI string;
   * for `ResourceTemplate` resources this is the underlying URI template.
   */
  uri?: string
}

/** Lightweight summary of an MCP prompt definition. */
export type McpPromptSummary = BaseMcpSummary

/** All discovered MCP definitions, summarized. */
export interface McpDefinitionsSummary {
  tools: McpToolSummary[]
  resources: McpResourceSummary[]
  prompts: McpPromptSummary[]
}

/** Options shared by every `listMcp*` / `getMcp*` helper. */
export interface ListMcpDefinitionsOptions {
  /**
   * H3 event used to evaluate per-definition [`enabled()`](/advanced/dynamic-definitions)
   * guards. Definitions whose guard returns `false` for this request are excluded.
   *
   * Omit it to include every discovered definition regardless of context.
   */
  event?: H3Event
  /**
   * Only include definitions whose group matches one of these values (OR-match).
   *
   * Auto-inferred from directory structure (e.g. `server/mcp/tools/admin/foo.ts` → `'admin'`)
   * or set explicitly on the definition.
   */
  group?: string | string[]
  /**
   * Only include definitions tagged with at least one of these tags (OR-match).
   *
   * To require **every** listed tag, post-filter the result with `Array.filter`.
   */
  tags?: string | string[]
  /**
   * Only include definitions attributed to one of these named handlers (OR-match).
   *
   * Attribution comes from folder convention: a file under
   * `server/mcp/handlers/<name>/{tools,resources,prompts}/` is automatically
   * tagged with `_meta.handler = '<name>'`.
   */
  handler?: string | string[]
  /**
   * When `true`, only return orphan definitions — those not attributed to any
   * named handler. Mutually exclusive with `handler`.
   *
   * @default false
   */
  orphansOnly?: boolean
}

type DefMeta = {
  name?: string
  group?: string
  tags?: string[]
  _meta?: Record<string, unknown>
  enabled?: (event: H3Event) => boolean | Promise<boolean>
}

/** Read the folder-attributed handler name from `_meta.handler`, if any. */
function readHandler(def: DefMeta): string | undefined {
  const value = def._meta?.handler
  return typeof value === 'string' ? value : undefined
}

function toArray(value: string | readonly string[] | undefined): string[] | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? [...value] : [value as string]
}

async function filterByEnabled<T extends DefMeta>(defs: readonly T[], event?: H3Event): Promise<T[]> {
  if (!event) return [...defs]
  const results = await Promise.all(
    defs.map(async (def) => {
      if (!def.enabled) return true
      try {
        return await def.enabled(event)
      }
      catch {
        return false
      }
    }),
  )
  return defs.filter((_, i) => results[i])
}

/**
 * Apply attribution + group + tags filters to a single definition.
 *
 * Returns `true` when the definition passes every active filter.
 *
 * @internal
 */
function matchesFilters(def: DefMeta, options: ListMcpDefinitionsOptions): boolean {
  const handler = readHandler(def)
  if (options.orphansOnly && handler) return false
  const wantedHandlers = toArray(options.handler)
  if (wantedHandlers && (!handler || !wantedHandlers.includes(handler))) return false
  const wantedGroups = toArray(options.group)
  if (wantedGroups) {
    const group = def.group ?? (def._meta?.group as string | undefined)
    if (!group || !wantedGroups.includes(group)) return false
  }
  const wantedTags = toArray(options.tags)
  if (wantedTags && !def.tags?.some(t => wantedTags.includes(t))) return false
  return true
}

/**
 * Filter raw definitions in-place using the same rules as `listMcp*` summaries.
 * Used by `defineMcpHandler` (via the runtime) and by `getMcp*` helpers.
 *
 * @internal
 */
export async function filterRawDefinitions<T extends DefMeta>(
  defs: readonly T[],
  options: ListMcpDefinitionsOptions = {},
): Promise<T[]> {
  const enabled = await filterByEnabled(defs, options.event)
  return enabled.filter(def => matchesFilters(def, options))
}

function summarizeBase(
  type: 'tool' | 'resource' | 'prompt',
  def: DefMeta & { title?: string, description?: string },
): BaseMcpSummary {
  const { name, title } = enrichNameTitle({
    name: def.name,
    title: def.title,
    _meta: def._meta,
    type,
  })
  const summary: BaseMcpSummary = { name }
  if (title) summary.title = title
  if (def.description) summary.description = def.description
  const group = def.group ?? (def._meta?.group as string | undefined)
  if (group) summary.group = group
  if (def.tags?.length) summary.tags = [...def.tags]
  const handler = readHandler(def)
  if (handler) summary.handler = handler
  return summary
}

function summarizeResource(resource: McpResourceDefinition): McpResourceSummary {
  const summary: McpResourceSummary = summarizeBase('resource', resource)
  if ('uri' in resource && resource.uri) {
    if (typeof resource.uri === 'string') {
      summary.uri = resource.uri
    }
    else {
      const template = (resource.uri as { uriTemplate?: { toString(): string } }).uriTemplate
      if (template) summary.uri = String(template)
    }
  }
  return summary
}

/**
 * Get **raw** MCP tool definitions matching the given filters.
 *
 * Unlike {@link listMcpTools} (which returns JSON-friendly summaries), this
 * returns the full definitions including handlers and Zod schemas — suitable
 * for passing back into `defineMcpHandler({ tools: ev => getMcpTools(...) })`.
 *
 * @example
 * ```ts
 * // server/mcp/handlers/searchable.ts — expose every tool tagged 'searchable'
 * import { defineMcpHandler, getMcpTools } from '@nuxtjs/mcp-toolkit/server'
 *
 * export default defineMcpHandler({
 *   tools: event => getMcpTools({ event, tags: ['searchable'] }),
 * })
 * ```
 */
export async function getMcpTools(
  options: ListMcpDefinitionsOptions = {},
): Promise<McpToolDefinitionListItem[]> {
  const { tools } = await import('#nuxt-mcp-toolkit/tools.mjs')
  return filterRawDefinitions(tools, options)
}

/** See {@link getMcpTools}. Returns raw resource definitions. */
export async function getMcpResources(
  options: ListMcpDefinitionsOptions = {},
): Promise<McpResourceDefinition[]> {
  const { resources } = await import('#nuxt-mcp-toolkit/resources.mjs')
  return filterRawDefinitions(resources, options)
}

/** See {@link getMcpTools}. Returns raw prompt definitions. */
export async function getMcpPrompts(
  options: ListMcpDefinitionsOptions = {},
): Promise<McpPromptDefinition[]> {
  const { prompts } = await import('#nuxt-mcp-toolkit/prompts.mjs')
  return filterRawDefinitions(prompts, options)
}

/**
 * List all MCP tools registered by the toolkit, as JSON-friendly summaries.
 *
 * Names and titles auto-generated from filenames are resolved here, so what
 * you get back matches what the MCP client sees in `tools/list`.
 *
 * Pass `event` to apply per-tool `enabled()` guards. Use `group` / `tags` /
 * `handler` to narrow the catalog. For raw definitions (e.g. to forward to
 * `defineMcpHandler`), use {@link getMcpTools} instead.
 *
 * @example
 * ```ts
 * // server/routes/.well-known/mcp/server-card.json.get.ts
 * import { listMcpTools } from '@nuxtjs/mcp-toolkit/server'
 *
 * export default defineEventHandler(async (event) => {
 *   const tools = await listMcpTools({ event })
 *   return { tools: tools.map(t => ({ name: t.name, description: t.description })) }
 * })
 * ```
 */
export async function listMcpTools(options: ListMcpDefinitionsOptions = {}): Promise<McpToolSummary[]> {
  const tools = await getMcpTools(options)
  return tools.map(t => summarizeBase('tool', t))
}

/** List all MCP resources registered by the toolkit, as JSON-friendly summaries. */
export async function listMcpResources(options: ListMcpDefinitionsOptions = {}): Promise<McpResourceSummary[]> {
  const resources = await getMcpResources(options)
  return resources.map(summarizeResource)
}

/** List all MCP prompts registered by the toolkit, as JSON-friendly summaries. */
export async function listMcpPrompts(options: ListMcpDefinitionsOptions = {}): Promise<McpPromptSummary[]> {
  const prompts = await getMcpPrompts(options)
  return prompts.map(p => summarizeBase('prompt', p))
}

/**
 * List all MCP definitions (tools, resources and prompts) in one call.
 *
 * The same options apply to each collection. Useful for
 * `/.well-known/mcp/server-card.json`-style endpoints, admin dashboards,
 * or any catalog page that needs the full inventory in a single request.
 */
export async function listMcpDefinitions(options: ListMcpDefinitionsOptions = {}): Promise<McpDefinitionsSummary> {
  const [tools, resources, prompts] = await Promise.all([
    listMcpTools(options),
    listMcpResources(options),
    listMcpPrompts(options),
  ])
  return { tools, resources, prompts }
}
