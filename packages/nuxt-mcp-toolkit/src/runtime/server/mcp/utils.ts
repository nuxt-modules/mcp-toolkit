import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eventHandler, readBody, sendRedirect } from 'h3'
import type { H3Event } from 'h3'
import { useNitroApp } from 'nitropack/runtime'
import { consola } from 'consola'
import type { McpMiddleware, McpIcon } from './definitions/handlers'
import type { McpPromptDefinition } from './definitions/prompts'
import { registerPromptFromDefinition } from './definitions/prompts'
import type { McpResourceDefinition } from './definitions/resources'
import { registerResourceFromDefinition } from './definitions/resources'
import type { McpToolDefinition, McpToolDefinitionListItem } from './definitions/tools'
import { registerToolFromDefinition } from './definitions/tools'
import type { CodeModeOptions } from './codemode'
import { getHeader, getRequestMethod } from './compat'
import { getEvlogLogger } from './internals'
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

/**
 * Fully-resolved MCP server config — `tools` / `resources` / `prompts` are
 * concrete arrays (no functions), filtered by `enabled(event)` guards.
 *
 * This is the shape passed to `mcp:config:resolved` Nitro hook listeners.
 * Mutating it in place affects what the per-request `McpServer` registers.
 */
export interface McpResolvedConfig {
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
): Promise<McpResolvedConfig> {
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

function registerEmptyDefinitionFallbacks(server: McpServer, config: McpResolvedConfig) {
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

export async function createMcpServer(config: McpResolvedConfig): Promise<McpServer> {
  const server = new McpServer({
    name: config.name,
    version: config.version,
    description: config.description,
    icons: config.icons,
  }, {
    instructions: config.instructions,
    capabilities: {
      logging: {},
    },
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

interface JsonRpcMessage {
  method?: unknown
  id?: unknown
  params?: Record<string, unknown> | null
}

interface RpcSummary {
  methods: string[]
  ids: (string | number)[]
  tools: string[]
  resources: string[]
  prompts: string[]
}

function summarizeRpcBody(body: unknown): RpcSummary | undefined {
  if (!body) return undefined
  const messages = (Array.isArray(body) ? body : [body]) as JsonRpcMessage[]
  const summary: RpcSummary = {
    methods: [],
    ids: [],
    tools: [],
    resources: [],
    prompts: [],
  }

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    if (typeof msg.method === 'string') summary.methods.push(msg.method)
    if (typeof msg.id === 'string' || typeof msg.id === 'number') summary.ids.push(msg.id)

    const params = msg.params
    if (params && typeof params === 'object') {
      const name = typeof params.name === 'string' ? params.name : undefined
      const uri = typeof params.uri === 'string' ? params.uri : undefined
      if (msg.method === 'tools/call' && name) summary.tools.push(name)
      if (msg.method === 'resources/read' && uri) summary.resources.push(uri)
      if (msg.method === 'prompts/get' && name) summary.prompts.push(name)
    }
  }

  if (
    !summary.methods.length
    && !summary.tools.length
    && !summary.resources.length
    && !summary.prompts.length
    && !summary.ids.length
  ) return undefined

  return summary
}

function pickOne<T>(values: T[]): T | T[] | undefined {
  if (!values.length) return undefined
  if (values.length === 1) return values[0]
  return values
}

/** Tag the wide event with `mcp.*` from the JSON-RPC body and transport headers. */
async function tagEvlogContext(event: H3Event, route: string) {
  const log = getEvlogLogger(event)
  if (!log) return

  const sessionId = getHeader(event, 'mcp-session-id')
  const mcp: Record<string, unknown> = {
    transport: 'streamable-http',
    route,
  }
  if (sessionId) mcp.session_id = sessionId

  const method = getRequestMethod(event)
  if (method.toUpperCase() === 'POST') {
    let summary: RpcSummary | undefined
    try {
      summary = summarizeRpcBody(await readBody(event))
    }
    catch {
      // Body unreadable / not JSON — skip enrichment
    }

    if (summary) {
      const m = pickOne(summary.methods)
      const id = pickOne(summary.ids)
      const tool = pickOne(summary.tools)
      const resource = pickOne(summary.resources)
      const prompt = pickOne(summary.prompts)
      if (m !== undefined) mcp[Array.isArray(m) ? 'methods' : 'method'] = m
      if (id !== undefined) mcp[Array.isArray(id) ? 'request_ids' : 'request_id'] = id
      if (tool !== undefined) mcp[Array.isArray(tool) ? 'tools' : 'tool'] = tool
      if (resource !== undefined) mcp[Array.isArray(resource) ? 'resources' : 'resource'] = resource
      if (prompt !== undefined) mcp[Array.isArray(prompt) ? 'prompts' : 'prompt'] = prompt
    }
  }

  log.set({ mcp })
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

const hookLog = consola.withTag('mcp-toolkit')

/** Fire a Nitro runtime hook, swallowing listener errors so the request continues. */
async function callMcpHook(
  name: 'mcp:config:resolved',
  ctx: { config: McpResolvedConfig, event: H3Event },
): Promise<void>
async function callMcpHook(
  name: 'mcp:server:created',
  ctx: { server: McpServer, event: H3Event },
): Promise<void>
async function callMcpHook(name: string, ctx: unknown): Promise<void> {
  try {
    const hooks = useNitroApp().hooks as { callHook: (name: string, ctx: unknown) => Promise<void> }
    await hooks.callHook(name, ctx)
  }
  catch (error) {
    hookLog.error(`Hook "${name}" threw — request continues`, error)
  }
}

/** Tag `user` / `session` from `event.context` (whatever auth middleware set). */
function tagAuthContext(event: H3Event) {
  const log = getEvlogLogger(event)
  if (!log) return

  const ctx = event.context as Record<string, unknown>
  const userObj = (ctx.user && typeof ctx.user === 'object') ? ctx.user as Record<string, unknown> : undefined
  const userId = asString(ctx.userId) ?? asString(userObj?.id)

  if (userObj || userId) {
    const user: Record<string, unknown> = {}
    if (userId) user.id = userId
    const email = asString(userObj?.email)
    if (email) user.email = email
    const name = asString(userObj?.name)
    if (name) user.name = name
    if (Object.keys(user).length > 0) log.set({ user })
  }

  const sessionObj = (ctx.session && typeof ctx.session === 'object') ? ctx.session as Record<string, unknown> : undefined
  const sessionId = asString(sessionObj?.id) ?? asString(ctx.sessionId)
  if (sessionId) log.set({ session: { id: sessionId } })
}

export function createMcpHandler(config: CreateMcpHandlerConfig) {
  return eventHandler(async (event: H3Event) => {
    const resolvedConfig = resolveConfig(config, event)
    await tagEvlogContext(event, event.path?.split('?')[0] || '/mcp')

    if (getHeader(event, 'accept')?.includes('text/html')) {
      return sendRedirect(event, resolvedConfig.browserRedirect)
    }

    const handler = async () => {
      tagAuthContext(event)
      const staticConfig = await resolveDynamicDefinitions(resolvedConfig, event)
      await callMcpHook('mcp:config:resolved', { config: staticConfig, event })
      const server = await createMcpServer(staticConfig)
      await callMcpHook('mcp:server:created', { server, event })
      return handleMcpRequest(() => server, event)
    }

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
