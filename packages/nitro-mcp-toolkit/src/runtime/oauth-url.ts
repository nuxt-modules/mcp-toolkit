const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function assertAbsoluteHttpUrl(value: string, label: string, allowQuery = false): URL {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`[nitro-mcp-toolkit] ${label} is not an absolute URL.`)
  }

  if (url.username || url.password) {
    throw new Error(`[nitro-mcp-toolkit] ${label} cannot include credentials.`)
  }

  if (url.hash || (!allowQuery && url.search)) {
    throw new Error(`[nitro-mcp-toolkit] ${label} cannot include a query or fragment.`)
  }

  const loopback = LOOPBACK_HOSTS.has(url.hostname)

  if (url.protocol === 'http:') {
    if (!loopback) {
      throw new Error(
        `[nitro-mcp-toolkit] ${label} must be HTTPS, except on a loopback host in development.`,
      )
    }
  } else if (url.protocol !== 'https:') {
    throw new Error(`[nitro-mcp-toolkit] ${label} must be an http(s) URL.`)
  }

  return url
}

function wellKnown(kind: string, value: string, label: string): URL {
  const url = assertAbsoluteHttpUrl(value, label)
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')

  return new URL(`/.well-known/${kind}${path}`, url.origin)
}

/**
 * Insert `/.well-known/oauth-protected-resource` between the origin and the
 * resource path, as RFC 9728 specifies for a resource identifier that has a
 * path component.
 */
export function protectedResourceMetadataUrl(resource: string): URL {
  return wellKnown('oauth-protected-resource', resource, '`resource`')
}

/**
 * Insert `/.well-known/oauth-authorization-server` between the origin and the
 * issuer path, as RFC 8414 specifies when the issuer identifier has a path
 * (Okta custom authorization servers, Auth0 with a custom domain path, …).
 */
export function authorizationServerMetadataUrl(issuer: string): URL {
  return wellKnown('oauth-authorization-server', issuer, '`authorizationServer`')
}
