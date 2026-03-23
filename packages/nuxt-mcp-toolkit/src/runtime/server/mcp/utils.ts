import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import * as h3 from 'h3'
import type { H3Event } from 'h3'
import type { McpMiddleware, McpIcon } from './definitions/handlers'
import type { McpPromptDefinition } from './definitions/prompts'
import { registerPromptFromDefinition } from './definitions/prompts'
import type { McpResourceDefinition } from './definitions/resources'
import { registerResourceFromDefinition } from './definitions/resources'
import type { McpToolDefinition, McpToolDefinitionListItem } from './definitions/tools'
import { registerToolFromDefinition } from './definitions/tools'
import type { CodeModeOptions } from './codemode'
// @ts-expect-error - Generated template that re-exports from provider
import handleMcpRequest from '#nuxt-mcp-toolkit/transport.mjs'

export type { McpTransportHandler } from './providers/types'
export { createMcpTransportHandler } from './providers/types'

type MaybeDynamic<T> = T | ((event: H3Event) => T | Promise<T>)

type MaybeDynamicTools = MaybeDynamic<McpToolDefinitionListItem[]>

export interface ResolvedMcpConfig {
  name: string
  version: string
  description?: string
  instructions?: string
  icons?: McpIcon[]
  browserRedirect: string
  tools?: MaybeDynamicTools
  resources?: MaybeDynamic<McpResourceDefinition[]>
  prompts?: MaybeDynamic<McpPromptDefinition[]>
  middleware?: McpMiddleware
  experimental_codeMode?: boolean | CodeModeOptions
}

interface StaticMcpConfig {
  name: string
  version: string
  description?: string
  instructions?: string
  icons?: McpIcon[]
  tools: McpToolDefinitionListItem[]
  resources: McpResourceDefinition[]
  prompts: McpPromptDefinition[]
  experimental_codeMode?: boolean | CodeModeOptions
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
    description: config.description,
    instructions: config.instructions,
    icons: config.icons,
    tools: await filterByEnabled(tools, event),
    resources: await filterByEnabled(resources, event),
    prompts: await filterByEnabled(prompts, event),
    experimental_codeMode: config.experimental_codeMode,
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

export async function createMcpServer(config: StaticMcpConfig): Promise<McpServer> {
  const server = new McpServer({
    name: config.name,
    version: config.version,
    description: config.description,
    icons: config.icons,
  }, {
    instructions: config.instructions,
  })

  let toolsToRegister: McpToolDefinition[] = config.tools as McpToolDefinition[]

  if (config.experimental_codeMode && toolsToRegister.length > 0) {
    const { createCodemodeTools } = await import('./codemode')
    const codeModeOptions = typeof config.experimental_codeMode === 'object' ? config.experimental_codeMode : undefined
    toolsToRegister = createCodemodeTools(toolsToRegister, codeModeOptions)
  }

  for (const tool of toolsToRegister) {
    registerToolFromDefinition(server, tool)
  }

  for (const resource of config.resources) {
    registerResourceFromDefinition(server, resource)
  }

  for (const prompt of config.prompts) {
    registerPromptFromDefinition(server, prompt)
  }

  registerEmptyDefinitionFallbacks(server, { ...config, tools: toolsToRegister })

  return server
}

export function createMcpHandler(config: CreateMcpHandlerConfig) {
  return h3.defineEventHandler(async (event: H3Event) => {
    const resolvedConfig = resolveConfig(config, event)

    if (h3.getHeader(event, 'accept')?.includes('text/html')) {
      return h3.sendRedirect(event, resolvedConfig.browserRedirect)
    }

    // Dynamic definitions are resolved inside the handler closure so they
    // run AFTER middleware has populated event.context (e.g. auth data).
    const handler = async () => {
      const staticConfig = await resolveDynamicDefinitions(resolvedConfig, event)
      const server = await createMcpServer(staticConfig)
      return handleMcpRequest(() => server, event)
    }

    // If middleware is defined, wrap the handler with it
    if (resolvedConfig.middleware) {
      let nextCalled = false
      let handlerResult: Response

      const next = async (): Promise<Response> => {
        nextCalled = true
        handlerResult = await handler() as Response
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

/**
 * Web `Request` for MCP.
 * h3 v2: `event.req` is the `Request`.
 * h3 v1: `toWebRequest` when present, else `event.web?.request`.
 */
export function eventToWebRequest(event: H3Event): Request {
  const e = event as H3Event & { req?: unknown, web?: { request?: Request } }
  if (e.req instanceof Request) return e.req
  if (e.web?.request) return e.web.request
  const toWebRequest = (h3 as Record<string, unknown>).toWebRequest as
    | ((ev: H3Event) => Request)
    | undefined
  if (typeof toWebRequest === 'function') {
    return toWebRequest(event)
  }
  throw new TypeError(
    '[@nuxtjs/mcp-toolkit] eventToWebRequest: need h3 v2 `event.req` or h3 v1 `toWebRequest`.',
  )
}
