import { H3Event, toResponse } from 'h3'
import { defineMcpHandler } from 'h3-mcp'
import { parseMcpToolsHeader, unknownToolNames, unknownToolsResponse } from './tools-header.ts'
import { resolveDefinitions, summarize } from './validate.ts'
import type { HandlerOptions as EngineOptions, PluginOptions, Subscription } from 'h3-mcp'
import type { McpNotifier } from './context.ts'
import type {
  McpDefinitionBuckets,
  McpDefinitionSummary,
  McpPrompt,
  McpResource,
  McpTool,
} from './definition.ts'

/**
 * Everything the engine takes that is not a definition: eras, caching, auth,
 * origin checks, request limits, subscriptions. Passed straight through, so the
 * toolkit never has to keep up with it.
 */
type EngineWiring = Omit<
  EngineOptions,
  'name' | 'version' | 'tools' | 'resources' | 'resourceTemplates' | 'prompts'
>

export interface McpHandlerOptions extends EngineWiring {
  /** Advertised to clients during initialization. */
  name?: string
  version?: string
  tools?: McpTool[]
  /** Static resources and URI templates alike. */
  resources?: McpResource[]
  prompts?: McpPrompt[]
  /**
   * Which browser origins may reach the endpoint, beyond the pages the app
   * serves to itself over loopback, which are accepted by default. Requests
   * carrying no `Origin` are unaffected, and a `validate` of your own replaces
   * the default. `false` drops the check.
   *
   * @example
   * ```ts
   * createMcpHandler({ origin: { allow: ['https://app.example.com'] } })
   * ```
   */
  origin?: EngineWiring['origin']
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

// The loopback test is not optional: `event.url` reads the `Host` header, which
// DNS rebinding sets to the attacker's own name — matching its `Origin`.
function sameLoopbackOrigin(origin: string, event: H3Event): boolean {
  return origin === event.url.origin && LOOPBACK_HOSTS.has(event.url.hostname)
}

function resolveOrigin(origin: McpHandlerOptions['origin']): EngineOptions['origin'] {
  if (origin === false) return false

  return { ...origin, validate: origin?.validate ?? sameLoopbackOrigin }
}

function createNotifier(): {
  notify: McpNotifier
  onListen: NonNullable<EngineWiring['onListen']>
} {
  const listeners = new Set<Subscription>()

  const notify: McpNotifier = {
    toolsChanged: () => {
      for (const subscription of listeners) void subscription.toolsListChanged()
    },
    promptsChanged: () => {
      for (const subscription of listeners) void subscription.promptsListChanged()
    },
    resourcesChanged: () => {
      for (const subscription of listeners) void subscription.resourcesListChanged()
    },
    resourceUpdated: (uri) => {
      for (const subscription of listeners) void subscription.resourceUpdated(uri)
    },
  }

  return {
    notify,
    onListen(subscription) {
      listeners.add(subscription)
      subscription.onClosed(() => {
        listeners.delete(subscription)
      })
    },
  }
}

/**
 * An MCP endpoint. It is directly usable as a Nitro route handler, and also
 * exposes the web-standard `fetch` face for any other runtime.
 */
export interface McpHandler {
  (event: H3Event): Promise<Response>
  /**
   * Serve one request outside of Nitro: Deno, Bun, a test, or any runtime that
   * speaks `fetch`.
   */
  fetch: (request: Request) => Promise<Response>
  /**
   * Everything this endpoint serves, as plain JSON — the full catalog, not the
   * per-request `X-MCP-Tools` subset.
   *
   * @example
   * ```ts
   * // server/routes/mcp-catalog.ts
   * import { mcp } from 'nitro-mcp-toolkit/servers'
   *
   * export default defineHandler(() =>
   *   mcp.definitions.filter((definition) => definition.tags?.includes('public')),
   * )
   * ```
   */
  definitions: readonly McpDefinitionSummary[]
  /** Push list-changed and resource-updated events to subscribed clients. */
  notify: McpNotifier
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
export function createMcpHandler(
  options: McpHandlerOptions = {},
  setup?: PluginOptions,
): McpHandler {
  const {
    name = 'nitro-mcp-server',
    version = '0.0.0',
    tools = [],
    resources = [],
    prompts = [],
    origin,
    auth,
    onListen: userOnListen,
    ...wiring
  } = options

  const resolvedOrigin = resolveOrigin(origin)

  // Static resolve throws on a bad `auth` / `origin` when the handler is
  // created, rather than on the first request.
  defineMcpHandler(
    {
      name,
      version,
      ...(auth !== undefined ? { auth } : {}),
      origin: resolvedOrigin,
    },
    setup,
  )

  const registrations = resolveDefinitions([...tools, ...resources, ...prompts])
  const { notify, onListen } = createNotifier()
  const buckets: McpDefinitionBuckets = {
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
  }

  for (const { definition, identity } of registrations) {
    definition.build(identity, buckets, notify)
  }

  const engine = defineMcpHandler((event) => {
    const requested = parseMcpToolsHeader(event.req.headers.get('x-mcp-tools'))
    const servedTools = requested
      ? buckets.tools.filter((tool) => typeof tool !== 'function' && requested.has(tool.name))
      : buckets.tools

    return {
      ...wiring,
      name,
      version,
      ...(auth !== undefined ? { auth } : {}),
      origin: resolvedOrigin,
      tools: servedTools,
      resources: buckets.resources,
      resourceTemplates: buckets.resourceTemplates,
      prompts: buckets.prompts,
      onListen(subscription, listenEvent) {
        onListen(subscription, listenEvent)
        return userOnListen?.(subscription, listenEvent)
      },
    }
  }, setup)

  const run = async (event: H3Event): Promise<Response> => {
    const requested = parseMcpToolsHeader(event.req.headers.get('x-mcp-tools'))
    if (requested) {
      const unknownNames = unknownToolNames(registrations, requested)
      if (unknownNames.length) {
        // Origin and auth must run first: a 400 on the name would otherwise
        // tell an unauthenticated caller whether the tool exists.
        const probe = new H3Event(
          new Request(event.url, {
            method: 'POST',
            headers: event.req.headers,
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
          }),
        )
        const gated = await toResponse(await engine(probe), probe)
        if (gated.status === 401 || gated.status === 403) return gated
        return unknownToolsResponse(unknownNames)
      }
    }

    return toResponse(await engine(event), event)
  }

  return Object.assign(run, {
    fetch: (request: Request) => run(new H3Event(request)),
    definitions: Object.freeze(summarize(registrations)),
    notify,
  })
}
