import { defineEventHandler, getRequestURL, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { AuthorizationServerMetadata } from './types'
import { getMcpConfig } from '../config'

/**
 * Authorization Server Metadata endpoint handler (RFC8414)
 * Serves metadata at /.well-known/oauth-authorization-server
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const config = getMcpConfig(runtimeConfig.mcp)

  // Get the request URL to derive issuer
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const mcpRoute = config.route || '/mcp'

  // Issuer (authorization server identifier)
  const issuer = config.oauth?.authorizationServer || origin

  // Use toolkit's built-in OAuth endpoints
  const authorizationEndpoint = `${origin}${mcpRoute}/oauth/authorize`
  const tokenEndpoint = `${origin}${mcpRoute}/oauth/token`
  const registrationEndpoint = `${origin}${mcpRoute}/register`

  // Scopes supported
  const scopes = config.oauth?.scopes || ['mcp:read', 'mcp:write']

  // Build Authorization Server Metadata response
  const metadata: AuthorizationServerMetadata = {
    issuer,
    authorization_endpoint: authorizationEndpoint,
    token_endpoint: tokenEndpoint,
    registration_endpoint: registrationEndpoint,
    scopes_supported: scopes,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'], // Public clients only for MCP
    // MCP requires PKCE with S256
    code_challenge_methods_supported: ['S256'],
  }

  // Set proper content type
  setResponseHeader(event, 'Content-Type', 'application/json')

  // Allow CORS for metadata discovery
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')

  return metadata
})
