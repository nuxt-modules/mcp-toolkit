import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { sendRedirect, getHeader, defineEventHandler } from 'h3'
import type { H3Event } from 'h3'
import type { McpMiddleware } from './definitions/handlers'
import type { McpPromptDefinition } from './definitions/prompts'
import { registerPromptFromDefinition } from './definitions/prompts'
import type { McpResourceDefinition } from './definitions/resources'
import { registerResourceFromDefinition } from './definitions/resources'
import type { McpToolDefinition } from './definitions/tools'
import { registerToolFromDefinition } from './definitions/tools'
// @ts-expect-error - Generated template that re-exports from provider
import handleMcpRequest from '#nuxt-mcp-toolkit/transport.mjs'

export type { McpTransportHandler } from './providers/types'
export { createMcpTransportHandler } from './providers/types'

type MaybeDynamic<T> = T | ((event: H3Event) => T | Promise<T>)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MaybeDynamicTools = MaybeDynamic<Array<McpToolDefinition<any, any>>>

export interface ResolvedMcpConfig {
  name: string
  version: string
  browserRedirect: string
  tools?: MaybeDynamicTools
  resources?: MaybeDynamic<McpResourceDefinition[]>
  prompts?: MaybeDynamic<McpPromptDefinition[]>
  middleware?: McpMiddleware
}

interface StaticMcpConfig {
  name: string
  version: string
  tools: McpToolDefinition[]
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
}

export type CreateMcpHandlerConfig = ResolvedMcpConfig | ((event: H3Event) => ResolvedMcpConfig)

function resolveConfig(config: CreateMcpHandlerConfig, event: H3Event): ResolvedMcpConfig {
  return typeof config === 'function' ? config(event) : config
}

async function filterByEnabled<T extends { enabled?: (event: H3Event) => boolean | Promise<boolean> }>(
  definitions: T[],
  event: H3Event,
): Promise<T[]> {
  const results = await Promise.all(
    definitions.map(async (def) => {
      if (!def.enabled) return true
      return def.enabled(event)
    }),
  )
  return definitions.filter((_, i) => results[i])
}

async function resolveDynamicDefinitions(
  config: ResolvedMcpConfig,
  event: H3Event,
): Promise<StaticMcpConfig> {
  const tools = typeof config.tools === 'function'
    ? await config.tools(event)
    : (config.tools || [])
  const resources = typeof config.resources === 'function'
    ? await config.resources(event)
    : (config.resources || [])
  const prompts = typeof config.prompts === 'function'
    ? await config.prompts(event)
    : (config.prompts || [])

  return {
    name: config.name,
    version: config.version,
    tools: await filterByEnabled(tools, event),
    resources: await filterByEnabled(resources, event),
    prompts: await filterByEnabled(prompts, event),
  }
}

function registerEmptyDefinitionFallbacks(server: McpServer, config: StaticMcpConfig) {
  if (!config.tools.length) {
    server.registerTool('__init__', {}, async () => ({ content: [] })).remove()
  }

  if (!config.resources.length) {
    server.registerResource('__init__', 'noop://init', {}, async () => ({ contents: [] })).remove()
  }

  if (!config.prompts.length) {
    server.registerPrompt('__init__', {}, async () => ({ messages: [] })).remove()
  }
}

export function createMcpServer(config: StaticMcpConfig): McpServer {
  const server = new McpServer({
    name: config.name,
    version: config.version,
  })

  for (const tool of config.tools as McpToolDefinition[]) {
    registerToolFromDefinition(server, tool)
  }

  for (const resource of config.resources) {
    registerResourceFromDefinition(server, resource)
  }

  for (const prompt of config.prompts) {
    registerPromptFromDefinition(server, prompt)
  }

  registerEmptyDefinitionFallbacks(server, config)

  return server
}

export function createMcpHandler(config: CreateMcpHandlerConfig) {
  return defineEventHandler(async (event: H3Event) => {
    const resolvedConfig = resolveConfig(config, event)

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
    }

    // Dynamic definitions are resolved inside the handler closure so they
    // run AFTER middleware has populated event.context (e.g. auth data).
    const handler = async () => {
      const staticConfig = await resolveDynamicDefinitions(resolvedConfig, event)
      return handleMcpRequest(() => createMcpServer(staticConfig), event)
    }

    // If middleware is defined, wrap the handler with it
    if (resolvedConfig.middleware) {
      let nextCalled = false
      let handlerResult: Response | undefined

      const next = async (): Promise<Response> => {
        nextCalled = true
        handlerResult = await handler()
        return handlerResult
      }

      const middlewareResult = await resolvedConfig.middleware(event, next)

      if (middlewareResult !== undefined) {
        return middlewareResult
      }

      if (nextCalled) {
        return handlerResult!
      }

      return handler()
    }

    return handler()
  })
}
