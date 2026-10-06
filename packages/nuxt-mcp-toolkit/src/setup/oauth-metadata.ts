import { addServerHandler } from '@nuxt/kit'
import type { Resolver } from '@nuxt/kit'

const WELL_KNOWN = ['oauth-protected-resource', 'oauth-authorization-server', 'openid-configuration']

// Without these, Nuxt answers OAuth discovery probes with HTML and breaks clients that parse JSON.
export function addOAuthMetadataHandlers(resolver: Resolver, prefix = ''): void {
  const handler = resolver.resolve('runtime/server/mcp/oauth-metadata')
  for (const name of WELL_KNOWN) {
    addServerHandler({ route: `${prefix}/.well-known/${name}`, handler })
    // RFC 9728 and RFC 8414 put the resource path after the suffix; path-appended probes never do.
    if (!prefix) addServerHandler({ route: `/.well-known/${name}/**`, handler })
  }
}
