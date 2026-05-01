import { addServerHandler, addServerTemplate, createResolver, defineNuxtModule, logger } from '@nuxt/kit'
import { defaultMcpConfig, getMcpConfig } from './runtime/server/mcp/config'
import { setupAutoImports } from './setup/auto-imports'
import { buildDefaultPaths, setupDefinitionsLoader } from './setup/definitions'
import { probeAppsDir } from './setup/mcp-apps/discover'
import { setupEvlog } from './setup/evlog'
import { setupNitroAliases } from './setup/nitro-aliases'
import { name, version } from '../package.json'
import type { McpIcon } from './runtime/server/mcp/definitions/handlers'
import type { McpConfig, McpDefaultHandlerStrategy, McpSecurityConfig } from './runtime/server/mcp/config'

const log = logger.withTag('@nuxtjs/mcp-toolkit')

export const { resolve } = createResolver(import.meta.url)

export type * from './runtime/server/types'

export interface ModuleOptions {
  /**
   * Enable or disable the MCP server
   * @default true
   */
  enabled?: boolean
  /**
   * The route path for the MCP server endpoint
   * @default '/mcp'
   */
  route?: string
  /**
   * URL to redirect to when a browser accesses the MCP endpoint
   * @default '/'
   */
  browserRedirect?: string
  /**
   * The name of the MCP server
   * @default Site name from site config or 'Docus Documentation'
   */
  name?: string
  /**
   * The version of the MCP server
   * @default '1.0.0'
   */
  version?: string
  /**
   * A human-readable description of this MCP server.
   * Part of `serverInfo` sent during initialization — used by clients
   * to display what this server is in UI (e.g. server lists, tooltips).
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization
   */
  description?: string
  /**
   * Operational instructions for AI agents on how to use this server.
   * Unlike `description` (which identifies the server), `instructions`
   * guide the LLM on workflows, constraints, and tool relationships.
   * Typically injected into the model's system prompt by the client.
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization
   */
  instructions?: string
  /**
   * Icons for this MCP server, displayed by clients in their UI.
   * Each icon specifies an image URL, MIME type, optional sizes, and optional theme.
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#initialization
   *
   * @example
   * ```ts
   * icons: [{ src: 'https://example.com/icon.png', mimeType: 'image/png', sizes: ['64x64'] }]
   * ```
   */
  icons?: McpIcon[]
  /**
   * Base directory for MCP definitions relative to server directory
   * The module will look for tools, resources, and prompts in subdirectories
   * @default 'mcp'
   */
  dir?: string
  /**
   * Base directory for MCP App SFCs relative to Nuxt's app directory.
   * The module will look for `.vue` files in this directory across layers.
   * @default 'mcp' (app/mcp)
   */
  appsDir?: string
  /**
   * How the default `/mcp` handler picks up auto-discovered definitions when
   * named handlers exist (`server/mcp/handlers/<name>/` or `handlers: 'name'` field).
   *
   * - `'orphans'` (default): the default handler only sees definitions that
   *   aren't attached to a named handler. Each definition lives in exactly
   *   one place. When no named handlers exist, behaves like `'all'`.
   * - `'all'`: pre-multi-handler behaviour — the default handler sees every
   *   discovered definition. Useful when you want a "kitchen sink" route in
   *   addition to specialized ones.
   *
   * @default 'orphans'
   * @see https://mcp-toolkit.nuxt.dev/handlers/organization
   */
  defaultHandlerStrategy?: McpDefaultHandlerStrategy
  /**
   * Auto-import MCP helpers (`defineMcpTool`, `defineMcpResource`, etc.),
   * types (`McpRequestExtra`, `McpToolExtra`, …), and the `InstallButton` component.
   *
   * Set to `false` to disable all auto-imports and require explicit imports
   * from `@nuxtjs/mcp-toolkit/server`.
   * @default true
   */
  autoImports?: boolean
  /**
   * Enable MCP session management (stateful transport).
   * When enabled, the server assigns session IDs and maintains state across requests,
   * enabling SSE streaming, server-to-client notifications, and session continuity.
   *
   * Pass `true` for defaults or an object to configure session behavior.
   * @default false
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#session-management
   */
  sessions?: boolean | {
    enabled?: boolean
    /**
     * Maximum session duration in milliseconds. Sessions inactive longer than this are cleaned up.
     * @default 1800000 (30 minutes)
     */
    maxDuration?: number
    /**
     * Maximum number of concurrent sessions. Returns 503 when exceeded.
     * @default 1000
     */
    maxSessions?: number
  }
  /**
   * Security configuration for the MCP server.
   * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#security-warning
   */
  security?: McpSecurityConfig
  /**
   * Server-side observability for MCP requests via [evlog](https://evlog.dev).
   *
   * Install `evlog` and register the `evlog/nuxt` module to enable wide
   * events on every MCP request — configure everything from the top-level
   * `evlog: { … }` key in nuxt.config.
   *
   * - `undefined` (default): on if `evlog/nuxt` is registered, off otherwise.
   * - `true`: assert `evlog/nuxt` is registered; throw at build otherwise.
   * - `false`: opt out.
   *
   * @see https://evlog.dev
   */
  logging?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: 'mcp',
    docs: 'https://mcp-toolkit.nuxt.dev/getting-started/installation',
    mcp: 'https://mcp-toolkit.nuxt.dev/mcp',
  },
  defaults: defaultMcpConfig,
  async setup(options, nuxt) {
    if (!options.enabled) return

    const nitroOptions = nuxt.options.nitro
    const isGenerating = (nuxt.options as { _generate?: boolean })._generate === true
    if (nitroOptions?.static || isGenerating) {
      log.warn('@nuxtjs/mcp-toolkit is not compatible with `nuxt generate` as it needs a server to run.')
      return
    }

    if (typeof options.sessions === 'boolean') {
      options.sessions = { enabled: options.sessions }
    }

    const mcpConfig = getMcpConfig(options as Partial<McpConfig>)
    if (mcpConfig.sessions.enabled) {
      nitroOptions.storage ??= {}
      nitroOptions.storage['mcp:sessions'] ??= { driver: 'memory' }
      nitroOptions.storage['mcp:sessions-meta'] ??= { driver: 'memory' }
    }

    const resolver = createResolver(import.meta.url)

    setupEvlog(nuxt, options)

    const appsDir = options.appsDir ?? 'mcp'
    const hasApps = probeAppsDir(appsDir)

    if (options.autoImports !== false) {
      setupAutoImports(resolver, { hasApps })
    }

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/config.mjs',
      getContents: () => `export default ${JSON.stringify(mcpConfig)}`,
    })

    setupDefinitionsLoader(nuxt, buildDefaultPaths(mcpConfig.dir), options, resolver, log, { appsDir })

    registerTypeReferences(nuxt, resolver)

    const aliases = setupNitroAliases(nuxt, resolver)

    addServerTemplate({
      filename: '#nuxt-mcp-toolkit/transport.mjs',
      getContents: () => {
        const provider = aliases.isCloudflare() ? 'cloudflare' : 'node'
        return `export { default } from '${resolver.resolve(`runtime/server/mcp/providers/${provider}`)}'`
      },
    })

    registerServerHandlers(options.route!, resolver)

    if (nuxt.options.dev) {
      const { addDevToolsCustomTabs } = await import('./runtime/server/mcp/devtools')
      addDevToolsCustomTabs(nuxt, options)
    }
  },
})

function registerTypeReferences(nuxt: import('@nuxt/schema').Nuxt, resolver: ReturnType<typeof createResolver>) {
  const virtualModulesDts = resolver.resolve('runtime/types/virtual-modules.d.ts')
  const hooksDts = resolver.resolve('runtime/server/types/hooks')

  nuxt.hook('prepare:types', ({ references }) => {
    references.push({ path: virtualModulesDts })
    references.push({ path: hooksDts })
  })

  const nitroOptions = nuxt.options.nitro
  if (!nitroOptions) return
  nitroOptions.typescript ??= {}
  nitroOptions.typescript.tsConfig ??= {}
  nitroOptions.typescript.tsConfig.include ??= []
  nitroOptions.typescript.tsConfig.include.push(virtualModulesDts, hooksDts)
}

function registerServerHandlers(route: string, resolver: ReturnType<typeof createResolver>) {
  addServerHandler({ route, handler: resolver.resolve('runtime/server/mcp/handler') })
  addServerHandler({ route: `${route}/deeplink`, handler: resolver.resolve('runtime/server/mcp/deeplink') })
  addServerHandler({ route: `${route}/badge.svg`, handler: resolver.resolve('runtime/server/mcp/badge-image') })

  // OAuth discovery endpoints (RFC 9728 / RFC 8414). MCP clients probe
  // these on connect; absent a real handler Nuxt would serve an HTML 404
  // and break clients that try to parse the body as JSON.
  const oauthHandler = resolver.resolve('runtime/server/mcp/oauth-metadata')
  addServerHandler({ route: '/.well-known/oauth-protected-resource', handler: oauthHandler })
  addServerHandler({ route: '/.well-known/oauth-protected-resource/**', handler: oauthHandler })
  addServerHandler({ route: '/.well-known/oauth-authorization-server', handler: oauthHandler })
  addServerHandler({ route: '/.well-known/oauth-authorization-server/**', handler: oauthHandler })
  addServerHandler({ route: '/.well-known/openid-configuration', handler: oauthHandler })
  addServerHandler({ route: '/.well-known/openid-configuration/**', handler: oauthHandler })
}
