import { getRouterParam } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'
import type { McpToolDefinition, McpResourceDefinition, McpPromptDefinition, McpHandlerOptions } from './definitions'
// @ts-expect-error - TODO: Fix this
import { tools } from '#nuxt-mcp/tools.mjs'
// @ts-expect-error - TODO: Fix this
import { resources } from '#nuxt-mcp/resources.mjs'
// @ts-expect-error - TODO: Fix this
import { prompts } from '#nuxt-mcp/prompts.mjs'
// @ts-expect-error - TODO: Fix this
import { handlers } from '#nuxt-mcp/handlers.mjs'
// @ts-expect-error - TODO: Fix this
import { defaultHandler } from '#nuxt-mcp/default-handler.mjs'
import { createMcpHandler } from './utils'
import { getMcpConfig } from './config'

export default createMcpHandler((event: H3Event) => {
  const runtimeConfig = useRuntimeConfig(event).mcp
  const config = getMcpConfig(runtimeConfig)
  const handlerName = getRouterParam(event, 'handler')

  // Custom handler via /mcp/:handler
  if (handlerName) {
    const handlerDef = (handlers as McpHandlerOptions[]).find(
      h => h.name === handlerName,
    )

    if (!handlerDef) {
      throw new Error(`Handler "${handlerName}" not found`)
    }

    return {
      name: handlerDef.name ?? handlerName,
      version: handlerDef.version ?? config.version,
      browserRedirect: handlerDef.browserRedirect ?? config.browserRedirect,
      tools: handlerDef.tools,
      resources: handlerDef.resources,
      prompts: handlerDef.prompts,
      middleware: handlerDef.middleware,
    }
  }

  // Default handler override via server/mcp/index.ts
  const defaultHandlerDef = defaultHandler as McpHandlerOptions | null
  if (defaultHandlerDef) {
    return {
      name: defaultHandlerDef.name ?? config.name ?? 'MCP Server',
      version: defaultHandlerDef.version ?? config.version,
      browserRedirect: defaultHandlerDef.browserRedirect ?? config.browserRedirect,
      // Use handler's definitions if specified, otherwise use global definitions
      tools: defaultHandlerDef.tools ?? (tools as McpToolDefinition[]),
      resources: defaultHandlerDef.resources ?? (resources as McpResourceDefinition[]),
      prompts: defaultHandlerDef.prompts ?? (prompts as McpPromptDefinition[]),
      middleware: defaultHandlerDef.middleware,
    }
  }

  // Default behavior: expose all global tools, resources, and prompts
  return {
    name: config.name || 'MCP Server',
    version: config.version,
    browserRedirect: config.browserRedirect,
    tools: tools as McpToolDefinition[],
    resources: resources as McpResourceDefinition[],
    prompts: prompts as McpPromptDefinition[],
  }
})
