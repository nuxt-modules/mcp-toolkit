import { getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition } from './definitions'
import type { McpHandlerOptions } from './definitions/handlers'
// @ts-expect-error - TODO: Fix this
import config from '#nuxt-mcp-toolkit/config.mjs'
// @ts-expect-error - TODO: Fix this
import { tools } from '#nuxt-mcp-toolkit/tools.mjs'
// @ts-expect-error - TODO: Fix this
import { resources } from '#nuxt-mcp-toolkit/resources.mjs'
// @ts-expect-error - TODO: Fix this
import { prompts } from '#nuxt-mcp-toolkit/prompts.mjs'
// @ts-expect-error - TODO: Fix this
import { handlers } from '#nuxt-mcp-toolkit/handlers.mjs'
// @ts-expect-error - TODO: Fix this
import { defaultHandler } from '#nuxt-mcp-toolkit/default-handler.mjs'
import { createMcpHandler } from './utils'

export default createMcpHandler((event: H3Event) => {
  const handlerName = getRouterParam(event, 'handler')

  // Custom handler via /mcp/:handler
  if (handlerName) {
    const handlerDef = (handlers as McpHandlerOptions[]).find(
      h => h.name === handlerName,
    )

    if (!handlerDef) {
      throw new Error(`Handler "${handlerName}" not found`)
    }

    const globalTools = tools as McpToolDefinition[]
    const globalResources = resources as McpResourceDefinition[]
    const globalPrompts = prompts as McpPromptDefinition[]

    return {
      name: handlerDef.name ?? handlerName,
      version: handlerDef.version ?? config.version,
      instructions: handlerDef.instructions ?? config.instructions,
      browserRedirect: handlerDef.browserRedirect ?? config.browserRedirect,
      tools: handlerDef.tools ?? globalTools,
      resources: handlerDef.resources ?? globalResources,
      prompts: handlerDef.prompts ?? globalPrompts,
      middleware: handlerDef.middleware,
      experimental_codeMode: handlerDef.experimental_codeMode,
    }
  }

  // Default handler override via server/mcp/index.ts
  const defaultHandlerDef = defaultHandler as McpHandlerOptions | null
  if (defaultHandlerDef) {
    // Definitions can be static arrays or dynamic functions — pass them through
    // for resolution after middleware runs (see resolveDynamicDefinitions in utils.ts)
    const globalTools = tools as McpToolDefinition[]
    const globalResources = resources as McpResourceDefinition[]
    const globalPrompts = prompts as McpPromptDefinition[]

    return {
      name: defaultHandlerDef.name ?? config.name ?? 'MCP Server',
      version: defaultHandlerDef.version ?? config.version,
      instructions: defaultHandlerDef.instructions ?? config.instructions,
      browserRedirect: defaultHandlerDef.browserRedirect ?? config.browserRedirect,
      tools: defaultHandlerDef.tools ?? globalTools,
      resources: defaultHandlerDef.resources ?? globalResources,
      prompts: defaultHandlerDef.prompts ?? globalPrompts,
      middleware: defaultHandlerDef.middleware,
      experimental_codeMode: defaultHandlerDef.experimental_codeMode,
    }
  }

  // Default behavior: expose all global tools, resources, and prompts
  return {
    name: config.name || 'MCP Server',
    version: config.version,
    instructions: config.instructions,
    browserRedirect: config.browserRedirect,
    tools: tools as McpToolDefinition[],
    resources: resources as McpResourceDefinition[],
    prompts: prompts as McpPromptDefinition[],
  }
})
