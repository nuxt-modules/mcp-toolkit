import type { McpEra, McpIcon } from 'h3-mcp'

/**
 * What the server advertises and how it answers — everything a definition file
 * cannot express. These cross into generated code, so they are data only: a
 * server needing a callback, such as `onListen` or `auth.validate`, mounts
 * `createMcpHandler` by hand.
 */
export interface McpServerOptions {
  /** Advertised to clients during initialization. */
  name?: string
  version?: string
  title?: string
  /** What this server is, for a human reading a client's server list. */
  description?: string
  /** Shown beside the server's name by clients that render one. */
  icons?: McpIcon[]
  /** Where a human can read more about this server. */
  websiteUrl?: string
  /** Guidance the client shows to the model about this server as a whole. */
  instructions?: string
  /**
   * Which protocol revisions the endpoint serves: both, 2026-07-28 only, or
   * the 2025 era only.
   *
   * @default 'dual'
   */
  era?: McpEra
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
