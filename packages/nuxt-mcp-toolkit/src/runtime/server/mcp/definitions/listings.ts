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
}

/** Lightweight summary of an MCP tool definition. */
export type McpToolSummary = BaseMcpSummary

/** Lightweight summary of an MCP resource definition. */
export interface McpResourceSummary extends BaseMcpSummary {
  /**
   * URI of the resource. For static resources this is the URI string;
   * for `ResourceTemplate` resources this is the underlying URI template.
   * Omitted for file-based resources that have not been registered yet.
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

/** Options shared by every `listMcp*` helper. */
export interface ListMcpDefinitionsOptions {
  /**
   * H3 event used to evaluate per-definition [`enabled()`](/advanced/dynamic-definitions)
   * guards. Definitions whose guard returns `false` for this request are excluded.
   *
   * Omit it to include every discovered definition regardless of context.
   */
  event?: H3Event
  /**
   * Only include definitions whose group matches one of these values.
   *
   * Auto-inferred from directory structure (e.g. `server/mcp/tools/admin/foo.ts` → `'admin'`)
   * or set explicitly on the definition. Pass a string to match a single group, or an array
   * to match any of them (OR).
   */
  group?: string | string[]
  /**
   * Only include definitions tagged with at least one of these tags (OR-match).
   *
   * To require **every** listed tag, post-filter the result with `Array.filter`.
   */
  tags?: string | string[]
}

type DefWithEnabled = { enabled?: (event: H3Event) => boolean | Promise<boolean> }

async function filterByEnabled<T extends DefWithEnabled>(defs: readonly T[], event?: H3Event): Promise<T[]> {
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

function toArray(value: string | readonly string[] | undefined): string[] | undefined {
  if (value == null) return undefined
  return Array.isArray(value) ? [...value] : [value as string]
}

function matchesGroupTags(summary: BaseMcpSummary, groups?: string[], tags?: string[]): boolean {
  if (groups && (!summary.group || !groups.includes(summary.group))) return false
  if (tags && !summary.tags?.some(t => tags.includes(t))) return false
  return true
}

function summarizeBase(
  type: 'tool' | 'resource' | 'prompt',
  def: { name?: string, title?: string, description?: string, group?: string, tags?: string[], _meta?: Record<string, unknown> },
): BaseMcpSummary {
  const { name, title } = enrichNameTitle({
    name: def.name,
    title: def.title,
    _meta: def._meta,
    type,
  })
  const group = def.group ?? (def._meta?.group as string | undefined)
  const summary: BaseMcpSummary = { name }
  if (title) summary.title = title
  if (def.description) summary.description = def.description
  if (group) summary.group = group
  if (def.tags?.length) summary.tags = [...def.tags]
  return summary
}

function summarizeTool(tool: McpToolDefinitionListItem): McpToolSummary {
  return summarizeBase('tool', tool)
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

function summarizePrompt(prompt: McpPromptDefinition): McpPromptSummary {
  return summarizeBase('prompt', prompt)
}

/**
 * List all MCP tools registered by the toolkit, as JSON-friendly summaries.
 *
 * Names and titles auto-generated from filenames are resolved here,
 * so what you get back matches exactly what the MCP client sees in
 * `tools/list`.
 *
 * Pass `event` to apply per-tool `enabled()` guards (e.g. hide admin-only
 * tools from anonymous requests). Use `group` / `tags` to further narrow
 * the catalog.
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
 *
 * @example Filter by group
 * ```ts
 * const adminTools = await listMcpTools({ event, group: 'admin' })
 * ```
 */
export async function listMcpTools(options: ListMcpDefinitionsOptions = {}): Promise<McpToolSummary[]> {
  const { tools } = await import('#nuxt-mcp-toolkit/tools.mjs')
  const filtered = await filterByEnabled(tools, options.event)
  const groups = toArray(options.group)
  const tags = toArray(options.tags)
  const summaries = filtered.map(summarizeTool)
  if (!groups && !tags) return summaries
  return summaries.filter(s => matchesGroupTags(s, groups, tags))
}

/**
 * List all MCP resources registered by the toolkit, as JSON-friendly summaries.
 *
 * Includes the resolved `uri` (or URI template) when available.
 */
export async function listMcpResources(options: ListMcpDefinitionsOptions = {}): Promise<McpResourceSummary[]> {
  const { resources } = await import('#nuxt-mcp-toolkit/resources.mjs')
  const filtered = await filterByEnabled(resources, options.event)
  const groups = toArray(options.group)
  const tags = toArray(options.tags)
  const summaries = filtered.map(summarizeResource)
  if (!groups && !tags) return summaries
  return summaries.filter(s => matchesGroupTags(s, groups, tags))
}

/**
 * List all MCP prompts registered by the toolkit, as JSON-friendly summaries.
 */
export async function listMcpPrompts(options: ListMcpDefinitionsOptions = {}): Promise<McpPromptSummary[]> {
  const { prompts } = await import('#nuxt-mcp-toolkit/prompts.mjs')
  const filtered = await filterByEnabled(prompts, options.event)
  const groups = toArray(options.group)
  const tags = toArray(options.tags)
  const summaries = filtered.map(summarizePrompt)
  if (!groups && !tags) return summaries
  return summaries.filter(s => matchesGroupTags(s, groups, tags))
}

/**
 * List all MCP definitions (tools, resources and prompts) in one call.
 *
 * The same `event` / `group` / `tags` options apply to each collection.
 * Useful for `/.well-known/mcp/server-card.json`-style endpoints, admin
 * dashboards, or any catalog page that needs the full inventory in
 * a single request.
 */
export async function listMcpDefinitions(options: ListMcpDefinitionsOptions = {}): Promise<McpDefinitionsSummary> {
  const [tools, resources, prompts] = await Promise.all([
    listMcpTools(options),
    listMcpResources(options),
    listMcpPrompts(options),
  ])
  return { tools, resources, prompts }
}
