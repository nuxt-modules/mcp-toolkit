import { setResponseHeader, setResponseStatus, getRequestURL, getHeader } from 'h3'
import type { H3Event } from 'h3'
import type { WWWAuthenticateParams } from './types'

/**
 * Build WWW-Authenticate header value
 */
export function buildWWWAuthenticateHeader(params: WWWAuthenticateParams): string {
  const parts = [`Bearer resource_metadata="${params.resource_metadata}"`]

  if (params.scope) {
    parts.push(`scope="${params.scope}"`)
  }

  if (params.error) {
    parts.push(`error="${params.error}"`)
  }

  if (params.error_description) {
    parts.push(`error_description="${params.error_description}"`)
  }

  return parts.join(', ')
}

/**
 * Send a 401 Unauthorized response with proper WWW-Authenticate header
 * according to MCP Authorization specification (RFC9728)
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export function sendUnauthorized(
  event: H3Event,
  options: {
    mcpRoute?: string
    scope?: string
    error?: WWWAuthenticateParams['error']
    errorDescription?: string
  } = {},
): void {
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const mcpRoute = options.mcpRoute || '/mcp'

  // Build resource metadata URL
  const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource${mcpRoute}`

  const wwwAuthParams: WWWAuthenticateParams = {
    resource_metadata: resourceMetadataUrl,
  }

  if (options.scope) {
    wwwAuthParams.scope = options.scope
  }

  if (options.error) {
    wwwAuthParams.error = options.error
  }

  if (options.errorDescription) {
    wwwAuthParams.error_description = options.errorDescription
  }

  // Set response status and headers
  setResponseStatus(event, 401)
  setResponseHeader(event, 'WWW-Authenticate', buildWWWAuthenticateHeader(wwwAuthParams))
  setResponseHeader(event, 'Content-Type', 'application/json')
}

/**
 * Send a 403 Forbidden response for insufficient scope
 */
export function sendForbidden(
  event: H3Event,
  options: {
    mcpRoute?: string
    requiredScope?: string
    errorDescription?: string
  } = {},
): void {
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const mcpRoute = options.mcpRoute || '/mcp'

  const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource${mcpRoute}`

  const wwwAuthParams: WWWAuthenticateParams = {
    resource_metadata: resourceMetadataUrl,
    error: 'insufficient_scope',
  }

  if (options.requiredScope) {
    wwwAuthParams.scope = options.requiredScope
  }

  if (options.errorDescription) {
    wwwAuthParams.error_description = options.errorDescription
  }

  setResponseStatus(event, 403)
  setResponseHeader(event, 'WWW-Authenticate', buildWWWAuthenticateHeader(wwwAuthParams))
  setResponseHeader(event, 'Content-Type', 'application/json')
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(event: H3Event): string | undefined {
  const authHeader = getHeader(event, 'authorization')

  if (!authHeader) {
    return undefined
  }

  // Check for Bearer scheme (case-insensitive)
  const match = authHeader.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    return undefined
  }

  return match[1]
}

// Re-export token validation from storage
export { getAccessToken, generateRandomString } from './storage'
