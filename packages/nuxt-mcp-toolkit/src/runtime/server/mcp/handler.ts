import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import type { McpHandlerOptions } from './definitions/handlers'
import config from '#nuxt-mcp-toolkit/config.mjs'
import { tools } from '#nuxt-mcp-toolkit/tools.mjs'
import { resources } from '#nuxt-mcp-toolkit/resources.mjs'
import { prompts } from '#nuxt-mcp-toolkit/prompts.mjs'
import { handlers } from '#nuxt-mcp-toolkit/handlers.mjs'
import { defaultHandler } from '#nuxt-mcp-toolkit/default-handler.mjs'
import { createMcpHandler } from './utils'

/**
 * Merge a per-handler override (custom or `defaultHandler`) onto the
 * module's global config + auto-discovered tools/resources/prompts.
 *
 * `name` is special-cased: when no override is set it falls back to
 * `config.name` and finally a sensible default chosen by the caller.
 */
function mergeMcpConfig(override: McpHandlerOptions | null, fallbackName: string) {
  return {
    name: override?.name ?? config.name ?? fallbackName,
    version: override?.version ?? config.version,
    description: override?.description ?? config.description,
    instructions: override?.instructions ?? config.instructions,
    icons: override?.icons ?? config.icons,
    browserRedirect: override?.browserRedirect ?? config.browserRedirect,
    tools: override?.tools ?? tools,
    resources: override?.resources ?? resources,
    prompts: override?.prompts ?? prompts,
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
    return mergeMcpConfig(handlerDef, handlerName)
  }

  if (defaultHandler) {
    return mergeMcpConfig(defaultHandler, 'MCP Server')
  }

  return mergeMcpConfig(null, 'MCP Server')
})
