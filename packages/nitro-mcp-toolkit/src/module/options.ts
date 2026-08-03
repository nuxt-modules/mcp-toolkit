import type { Icon, PerRequestResponseMode } from '@modelcontextprotocol/server'

/**
 * What the server advertises and how it answers — everything a definition file
 * cannot express. These cross into generated code, so they are data only:
 * a server needing `bus` or `onError` mounts `createMcpHandler` by hand.
 */
export interface McpServerOptions {
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
   * Browser origins allowed beyond the app's own loopback pages, which pass by
   * default. Requests carrying no `Origin` — every MCP client proper — are
   * unaffected. `false` drops the check.
   *
   * @example
   * ```ts
   * mcp({ origin: { allow: ['https://app.example.com'] } })
   * ```
   */
  origin?: false | { allow?: string[]; allowMissing?: boolean }
}

export interface McpModuleOptions extends McpServerOptions {
  /**
   * Where the endpoint is mounted.
   *
   * @default '/mcp'
   */
  route?: string
  /**
   * Directory scanned for `tools/`, `resources/` and `prompts/`, relative to
   * the Nitro root.
   *
   * @default 'server/mcp'
   */
  dir?: string
}

export interface ResolvedMcpModuleOptions {
  route: string
  dir: string
  server: McpServerOptions
}

/** `/Mcp/` and `mcp` alike become `/mcp`, so a route always matches as written. */
function normalizeRoute(route: string): string {
  const trimmed = route.trim().replace(/\/+$/, '')

  if (trimmed === '') {
    throw new Error('[nitro-mcp-toolkit] `route` cannot be empty.')
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function resolveModuleOptions(options: McpModuleOptions = {}): ResolvedMcpModuleOptions {
  const { route = '/mcp', dir = 'server/mcp', ...server } = options

  return { route: normalizeRoute(route), dir, server }
}
