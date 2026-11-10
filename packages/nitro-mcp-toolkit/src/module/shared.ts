import { statSync } from 'node:fs'
import { basename, resolve } from 'pathe'
import { discoverDefinitions, discoverPlugins, discoverServerConfig } from './discover.ts'
import { resolveModuleOptions } from './options.ts'
import { reportDefinitions } from './report.ts'
import { registerServer, slugify } from './servers.ts'
import { protectedResourceMetadataUrl } from '../runtime/oauth-url.ts'
import {
  renderAuthorizationServer,
  renderHandler,
  renderNitro2Handler,
  renderOAuth,
  renderOAuthMetadata,
  renderRegistry,
  renderRuntimeOAuthMetadata,
  renderServerMetadata,
} from './template.ts'
import { watchDefinitions } from './watch.ts'
import type { McpModuleOptions } from './options.ts'
import type { McpNitro } from './nitro.ts'

const AS_METADATA = '/.well-known/oauth-authorization-server'

/** Select a root module when the convention is unambiguous. */
function oneRootFile(route: string, name: string, paths: string[]): string | undefined {
  if (paths.length > 1) {
    throw new Error(
      `[nitro-mcp-toolkit] ${route} has more than one ${name} file ` +
        `(${paths.map((path) => basename(path)).join(', ')}). Keep one.`,
    )
  }

  return paths[0]
}

export function createModule(options: McpModuleOptions, nitro2?: { h3: string }) {
  const { route, dir, server, auth, oauth, include } = resolveModuleOptions(options)
  const slug = slugify(route)

  return {
    name: `mcp:${slug}`,
    setup(nitro: McpNitro) {
      const registryId = `#mcp/${slug}/registry`
      const handlerId = `#mcp/${slug}/handler`
      const oauthId = `#mcp/${slug}/oauth`
      const metadataId = `#mcp/${slug}/oauth-metadata`
      const asId = `#mcp/${slug}/oauth-authorization-server`

      if (handlerId in nitro.options.virtual) {
        throw new Error(
          `[nitro-mcp-toolkit] Two MCP servers are mounted on ${route}. ` +
            'Give each `mcp()` its own `route`.',
        )
      }

      const authPath = auth ? resolve(nitro.options.rootDir, auth) : undefined
      if (authPath && !statSync(authPath, { throwIfNoEntry: false })?.isFile()) {
        throw new Error(`[nitro-mcp-toolkit] ${route} auth module not found: ${authPath}`)
      }

      const definitionsDir = (typeof dir === 'string' ? [dir] : dir).map((root) =>
        resolve(nitro.options.rootDir, root),
      )

      nitro.options.virtual[registryId] = async () =>
        renderRegistry(await discoverDefinitions(definitionsDir, include))
      nitro.options.virtual[`#mcp-config:${route}`] = async () =>
        renderServerMetadata(
          server,
          oneRootFile(route, 'index', await discoverServerConfig(definitionsDir)),
        )
      // Async like the registry: a plugins file written after setup is picked
      // up by the rebuild the watcher triggers, rather than needing a restart.
      nitro.options.virtual[handlerId] = async () => {
        const pluginsPath = oneRootFile(route, 'plugins', await discoverPlugins(definitionsDir))
        const configPath = oneRootFile(route, 'index', await discoverServerConfig(definitionsDir))

        return renderHandler(registryId, server, {
          ...(authPath ? { authPath } : {}),
          ...(configPath
            ? {
                configPath,
                oauthMetadataPath: protectedResourceMetadataUrl(`http://localhost${route}`)
                  .pathname,
              }
            : {}),
          ...(include?.plugins?.length ? { extraPlugins: include.plugins } : {}),
          ...(nitro2 ? { nitro2: true } : {}),
          ...(oauth ? { oauthId } : {}),
          ...(pluginsPath ? { pluginsPath } : {}),
        })
      }
      registerServer(nitro, { route, slug, handlerId })

      const mount = (id: string) => {
        if (!nitro2) return id
        const adapterId = `${id}/nitro2`
        nitro.options.virtual[adapterId] = () => renderNitro2Handler(id, nitro2.h3)
        return adapterId
      }

      nitro.options.handlers.push({
        route,
        handler: mount(handlerId),
        // Matches Nitro's own file-based routes: the handler is only loaded
        // once a request actually asks for it.
        lazy: true,
        middleware: false,
      })

      if (oauth) {
        const metadataPath = protectedResourceMetadataUrl(oauth.resource).pathname

        nitro.options.virtual[oauthId] = () => renderOAuth(oauth)
        nitro.options.virtual[metadataId] = () => renderOAuthMetadata(oauthId)
        nitro.options.handlers.push({
          route: metadataPath,
          handler: mount(metadataId),
          lazy: true,
          middleware: false,
        })

        if (
          oauth.authorizationServer &&
          !nitro.options.handlers.some((handler) => handler.route === AS_METADATA)
        ) {
          nitro.options.virtual[asId] = () => renderAuthorizationServer(oauthId)
          nitro.options.handlers.push({
            route: AS_METADATA,
            handler: mount(asId),
            lazy: true,
            middleware: false,
          })
        }
      }

      if (!oauth) {
        const metadataPath = protectedResourceMetadataUrl(`http://localhost${route}`).pathname
        nitro.options.virtual[metadataId] = () => renderRuntimeOAuthMetadata(handlerId)
        nitro.options.handlers.push({
          route: metadataPath,
          handler: mount(metadataId),
          lazy: true,
          middleware: false,
        })
      }

      reportDefinitions(nitro, route, definitionsDir, include)

      if (nitro.options.dev) {
        for (const root of definitionsDir) watchDefinitions(nitro, root)
      }
    },
  }
}
