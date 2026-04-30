import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import type { McpHandlerOptions } from './definitions/handlers'
import type { McpToolDefinitionListItem } from './definitions/tools'
import type { McpResourceDefinition } from './definitions/resources'
import type { McpPromptDefinition } from './definitions/prompts'
import type { ListMcpDefinitionsOptions } from './definitions/listings'
import { filterRawDefinitions } from './definitions/listings'
import config from '#nuxt-mcp-toolkit/config.mjs'
import { tools } from '#nuxt-mcp-toolkit/tools.mjs'
import { resources } from '#nuxt-mcp-toolkit/resources.mjs'
import { prompts } from '#nuxt-mcp-toolkit/prompts.mjs'
import { handlers } from '#nuxt-mcp-toolkit/handlers.mjs'
import { defaultHandler } from '#nuxt-mcp-toolkit/default-handler.mjs'
import { createMcpHandler } from './utils'

type DefField<T> = T[] | ((event: H3Event) => T[] | Promise<T[]>) | undefined

/**
 * Resolve a `defineMcpHandler` `tools | resources | prompts` field into a
 * function `(event) => T[]` that the runtime calls at request time.
 *
 * - `array`     → return as-is (statically wired definitions).
 * - `function`  → return as-is (user-provided dynamic resolver).
 * - `undefined` → auto-resolve via `filterRawDefinitions` against the global
 *                 pool, applying `baseFilter` (handler attribution for named
 *                 handlers, `defaultHandlerStrategy` for the default handler).
 */
function resolveField<T extends {
  name?: string
  group?: string
  tags?: string[]
  _meta?: Record<string, unknown>
  enabled?: (event: H3Event) => boolean | Promise<boolean>
}>(
  field: DefField<T>,
  pool: readonly T[],
  baseFilter: ListMcpDefinitionsOptions,
): T[] | ((event: H3Event) => T[] | Promise<T[]>) {
  if (Array.isArray(field)) return field
  if (typeof field === 'function') return field
  return (event: H3Event) => filterRawDefinitions(pool, { ...baseFilter, event })
}

/**
 * Pick the base attribution filter for a handler. The decision is deterministic
 * and based on **where the handler config file lives**:
 *
 * - **Default handler** (`/mcp`): obeys `mcp.defaultHandlerStrategy` —
 *   `'orphans'` (default) only sees orphan definitions, `'all'` sees everything.
 * - **Folder handler** (`server/mcp/handlers/<name>/index.ts`): defaults to
 *   definitions attributed to `<name>` via folder convention.
 * - **Top-level handler** (`server/mcp/<name>.ts`): defaults to every discovered
 *   definition (back-compat with the pre-attribution behaviour). Use the
 *   function form (`tools: ev => getMcpTools({ event: ev, ... })`) to filter.
 *
 * The runtime distinguishes folder handlers from top-level handlers via the
 * `_meta.handler` marker injected by the loader.
 */
function pickBaseFilter(handlerDef: McpHandlerOptions | null, handlerName: string | null): ListMcpDefinitionsOptions {
  if (handlerName === null) {
    return config.defaultHandlerStrategy === 'orphans' ? { orphansOnly: true } : {}
  }
  const meta = (handlerDef as { _meta?: Record<string, unknown> } | null)?._meta
  const isFolderHandler = meta?.handler === handlerName
  return isFolderHandler ? { handler: handlerName } : {}
}

function mergeMcpConfig(override: McpHandlerOptions | null, fallbackName: string, handlerName: string | null) {
  const baseFilter = pickBaseFilter(override, handlerName)
  return {
    name: override?.name ?? config.name ?? fallbackName,
    version: override?.version ?? config.version,
    description: override?.description ?? config.description,
    instructions: override?.instructions ?? config.instructions,
    icons: override?.icons ?? config.icons,
    browserRedirect: override?.browserRedirect ?? config.browserRedirect,
    tools: resolveField<McpToolDefinitionListItem>(override?.tools, tools, baseFilter),
    resources: resolveField<McpResourceDefinition>(override?.resources, resources, baseFilter),
    prompts: resolveField<McpPromptDefinition>(override?.prompts, prompts, baseFilter),
    middleware: override?.middleware,
    experimental_codeMode: override?.experimental_codeMode,
  }
}

export default createMcpHandler((event: H3Event) => {
  const handlerName = getRouterParam(event, 'handler')

  if (handlerName) {
    const handlerDef = handlers.find(h => h.name === handlerName)
    if (!handlerDef) {
      throw new Error(`Handler "${handlerName}" not found`)
    }
    return mergeMcpConfig(handlerDef as McpHandlerOptions, handlerName, handlerName)
  }

  if (defaultHandler) {
    return mergeMcpConfig(defaultHandler, 'MCP Server', null)
  }

  return mergeMcpConfig(null, 'MCP Server', null)
})
