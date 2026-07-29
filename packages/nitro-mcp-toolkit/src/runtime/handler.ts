import { createMcpHandler as createSdkHandler, McpServer } from '@modelcontextprotocol/server'
import { H3Event } from 'h3'
import { runWithRequest, setEra } from './context.ts'
import type {
  McpHandlerRequestOptions,
  PerRequestResponseMode,
  ServerEventBus,
  ServerNotifier,
} from '@modelcontextprotocol/server'
import type { McpPrompt, McpResource, McpTool } from './definition.ts'

export interface McpHandlerOptions {
  /** Advertised to clients during initialization. */
  name?: string
  version?: string
  title?: string
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
  /** Serve one request outside of Nitro (Workers, Deno, Bun, or a test). */
  fetch: (request: Request, options?: McpHandlerRequestOptions) => Promise<Response>
  /** Push list-changed and resource-updated events to subscribed clients. */
  notify: ServerNotifier
  bus: ServerEventBus
  close: () => Promise<void>
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
  const { tools = [], resources = [], prompts = [] } = options
  const definitions = [...tools, ...resources, ...prompts]

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
        },
        { instructions: options.instructions },
      )

      for (const definition of definitions) {
        definition.register(server)
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
  // the request: handlers get a consistent `ctx.event` either way.
  const fetch: McpHandler['fetch'] = (request, requestOptions) =>
    runWithRequest(new H3Event(request), () => sdk.fetch(request, requestOptions))

  const handle = (event: H3Event): Promise<Response> =>
    runWithRequest(event, () => sdk.fetch(event.req))

  return Object.assign(handle, {
    fetch,
    notify: sdk.notify,
    bus: sdk.bus,
    close: sdk.close,
  })
}
