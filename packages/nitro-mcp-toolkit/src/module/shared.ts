import { basename, resolve } from 'pathe'
import { discoverDefinitions, discoverPlugins } from './discover.ts'
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
} from './template.ts'
import { watchDefinitions } from './watch.ts'
import type { McpModuleOptions } from './options.ts'
import type { McpNitro } from './nitro.ts'

const AS_METADATA = '/.well-known/oauth-authorization-server'

/** Which plugins file the handler installs, when the convention is unambiguous. */
function onePluginsFile(route: string, paths: string[]): string | undefined {
  if (paths.length > 1) {
    throw new Error(
      `[nitro-mcp-toolkit] ${route} has more than one plugins file ` +
        `(${paths.map((path) => basename(path)).join(', ')}). Keep one.`,
    )
  }

  return paths[0]
}

export function createModule(options: McpModuleOptions, nitro2?: { h3: string }) {
  const { route, dir, server, oauth } = resolveModuleOptions(options)
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

      const definitionsDir = resolve(nitro.options.rootDir, dir)

      nitro.options.virtual[registryId] = async () =>
        renderRegistry(await discoverDefinitions(definitionsDir))
      // Async like the registry: a plugins file written after setup is picked
      // up by the rebuild the watcher triggers, rather than needing a restart.
      nitro.options.virtual[handlerId] = async () => {
        const pluginsPath = onePluginsFile(route, await discoverPlugins(definitionsDir))

        return renderHandler(registryId, server, {
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

      reportDefinitions(nitro, route, definitionsDir)

      if (nitro.options.dev) {
        watchDefinitions(nitro, definitionsDir)
      }
    },
  }
}
