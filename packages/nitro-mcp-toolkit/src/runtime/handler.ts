import { createMcpHandler as createSdkHandler, McpServer } from '@modelcontextprotocol/server'
import { H3Event } from 'h3'
import { buildAuthGate } from './auth.ts'
import { getToolAllowlist, runWithRequest, setEra } from './context.ts'
import { forbiddenOriginResponse, isOriginAllowed } from './origin.ts'
import {
  filterRegistrationsByToolAllowlist,
  parseMcpToolsHeader,
  unknownToolsResponse,
} from './tools-header.ts'
import { resolveDefinitions, summarize } from './validate.ts'
import type { McpRegistration } from './validate.ts'
import type {
  Icon,
  McpHandlerRequestOptions,
  PerRequestResponseMode,
  ServerEventBus,
  ServerNotifier,
} from '@modelcontextprotocol/server'
import type { McpAuthOptions } from './auth.ts'
import type { McpDefinitionSummary, McpPrompt, McpResource, McpTool } from './definition.ts'
import type { McpOriginOptions } from './origin.ts'

export interface McpHandlerOptions {
  /** Advertised to clients during initialization. */
  name?: string
  version?: string
  title?: string
  /** What this server is, for a human reading a client's server list. */
  description?: string
  /** Shown beside the server's name by clients that render one. */
  icons?: Icon[]
  /** Where a human can read more about this server. */
  websiteUrl?: string
  /** Guidance the client shows to the model about this server as a whole. */
  instructions?: string
  tools?: McpTool[]
  resources?: McpResource[]
  prompts?: McpPrompt[]
  /**
   * How 2025-era clients are served: through the SDK's stateless fallback, or
   * refused outright for a 2026-07-28-only endpoint.
   *
   * @default 'stateless'
   */
  legacy?: 'stateless' | 'reject'
  /**
   * Whether modern exchanges answer with a single JSON body or an SSE stream.
   *
   * @default 'auto'
   */
  responseMode?: PerRequestResponseMode
  /**
   * Which browser origins may reach the endpoint, beyond the pages the app
   * serves to itself over loopback, which are accepted by default. Requests
   * carrying no `Origin` are unaffected. `false` drops the check.
   *
   * @example
   * ```ts
   * createMcpHandler({ origin: { allow: ['https://app.example.com'] } })
   * ```
   */
  origin?: McpOriginOptions
  /**
   * Require a bearer token or API key on every request. Off by default —
   * many MCP endpoints sit behind a gateway that already authenticates.
   *
   * @example
   * ```ts
   * createMcpHandler({ auth: { tokens: [process.env.MCP_TOKEN!] } })
   * ```
   */
  auth?: McpAuthOptions
  /**
   * The change-event bus backing `subscriptions/listen`. Supply a shared
   * implementation to notify clients from several processes.
   */
  bus?: ServerEventBus
  /** Called for out-of-band errors; it never alters the response. */
  onError?: (error: Error) => void
}

/**
 * An MCP endpoint. It is directly usable as a Nitro route handler, and also
 * exposes the web-standard `fetch` face for any other runtime.
 */
export interface McpHandler {
  (event: H3Event): Promise<Response>
  /**
   * Serve one request outside of Nitro: Deno, Bun, a test, or any runtime that
   * provides `node:async_hooks` — on Cloudflare Workers that means enabling the
   * `nodejs_compat` flag, which the request context depends on.
   */
  fetch: (request: Request, options?: McpHandlerRequestOptions) => Promise<Response>
  /**
   * Everything this endpoint serves, as plain JSON — the full catalog, not the
   * per-request `X-MCP-Tools` subset.
   *
   * @example
   * ```ts
   * // server/routes/mcp-catalog.ts
   * import mcp from '#mcp/mcp/handler'
   *
   * export default defineHandler(() =>
   *   mcp.definitions.filter((definition) => definition.tags?.includes('public')),
   * )
   * ```
   */
  definitions: readonly McpDefinitionSummary[]
  /** Push list-changed and resource-updated events to subscribed clients. */
  notify: ServerNotifier
  bus: ServerEventBus
  close: () => Promise<void>
}

function gateToolsHeader(
  registrations: readonly McpRegistration[],
  event: H3Event,
): Set<string> | Response | undefined {
  const requested = parseMcpToolsHeader(event.req.headers.get('x-mcp-tools'))
  if (!requested) return undefined
  const { unknownNames } = filterRegistrationsByToolAllowlist(registrations, requested)
  if (unknownNames.length) return unknownToolsResponse(unknownNames)
  return requested
}

/**
 * Create an MCP endpoint from a set of definitions.
 *
 * @example
 * ```ts
 * // server/routes/mcp.ts
 * export default createMcpHandler({ name: 'my-app', tools: [greet] })
 * ```
 */
export function createMcpHandler(options: McpHandlerOptions = {}): McpHandler {
  const { tools = [], resources = [], prompts = [], origin } = options
  const registrations = resolveDefinitions([...tools, ...resources, ...prompts])
  // Built once, eagerly, so a misconfigured `auth` throws when the handler is
  // created rather than on the first request.
  const authGate = buildAuthGate(options.auth)

  const sdk = createSdkHandler(
    (requestCtx) => {
      // Called once per request, so definitions can never leak state between
      // clients; the same set serves both protocol eras.
      setEra(requestCtx.era)

      const server = new McpServer(
        {
          name: options.name ?? 'nitro-mcp-server',
          version: options.version ?? '0.0.0',
          title: options.title,
          description: options.description,
          icons: options.icons,
          websiteUrl: options.websiteUrl,
        },
        { instructions: options.instructions },
      )

      const allowlist = getToolAllowlist()
      const toRegister = allowlist
        ? registrations.filter(
            (entry) => entry.definition.kind !== 'tool' || allowlist.has(entry.identity.name),
          )
        : registrations

      for (const { definition, identity } of toRegister) {
        definition.register(server, identity)
      }

      return server
    },
    {
      legacy: options.legacy,
      responseMode: options.responseMode,
      bus: options.bus,
      onerror: options.onError,
    },
  )

  // Driven bare, there is no Nitro event to carry, so one is synthesized over
  // the request: handlers get a consistent `event` either way.
  const fetch: McpHandler['fetch'] = async (request, requestOptions) => {
    const event = new H3Event(request)
    if (!isOriginAllowed(event, origin)) return forbiddenOriginResponse()

    const denied = await authGate?.(event)
    if (denied) return denied

    const toolsHeader = gateToolsHeader(registrations, event)
    if (toolsHeader instanceof Response) return toolsHeader

    return runWithRequest(event, sdk.notify, () => sdk.fetch(request, requestOptions), toolsHeader)
  }

  const handle = async (event: H3Event): Promise<Response> => {
    if (!isOriginAllowed(event, origin)) return forbiddenOriginResponse()

    const denied = await authGate?.(event)
    if (denied) return denied

    const toolsHeader = gateToolsHeader(registrations, event)
    if (toolsHeader instanceof Response) return toolsHeader

    return runWithRequest(event, sdk.notify, () => sdk.fetch(event.req), toolsHeader)
  }

  return Object.assign(handle, {
    fetch,
    definitions: Object.freeze(summarize(registrations)),
    notify: sdk.notify,
    bus: sdk.bus,
    close: sdk.close,
  })
}
