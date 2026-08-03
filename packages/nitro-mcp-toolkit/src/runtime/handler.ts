import { H3Event, toResponse } from 'h3'
import { defineMcpHandler } from 'h3-mcp'
import { resolveDefinitions, summarize } from './validate.ts'
import type { McpHandlerOptions as EngineOptions } from 'h3-mcp'
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

/**
 * An MCP endpoint. It is directly usable as a Nitro route handler, and also
 * exposes the web-standard `fetch` face for any other runtime.
 */
export interface McpHandler {
  (event: H3Event): unknown
  /** Serve one request outside of Nitro: Deno, Bun, a test, an edge runtime. */
  fetch: (request: Request) => Promise<Response>
  /**
   * Everything this endpoint serves, as plain JSON — a catalog of the same set
   * every client sees.
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
  const {
    name = 'nitro-mcp-server',
    version = '0.0.0',
    tools = [],
    resources = [],
    prompts = [],
    origin,
    ...wiring
  } = options

  const registrations = resolveDefinitions([...tools, ...resources, ...prompts])
  const buckets: McpDefinitionBuckets = {
    tools: [],
    resources: [],
    resourceTemplates: [],
    prompts: [],
  }

  for (const { definition, identity } of registrations) {
    definition.build(identity, buckets)
  }

  const handle = defineMcpHandler({
    ...wiring,
    name,
    version,
    origin: resolveOrigin(origin),
    ...buckets,
  })

  // Driven bare, there is no Nitro event to serve, so one is made over the
  // request: handlers get a consistent `ctx.event` either way.
  const fetch: McpHandler['fetch'] = async (request) => {
    const event = new H3Event(request)
    return toResponse(await handle(event), event)
  }

  return Object.assign(handle, {
    fetch,
    definitions: Object.freeze(summarize(registrations)),
  })
}
