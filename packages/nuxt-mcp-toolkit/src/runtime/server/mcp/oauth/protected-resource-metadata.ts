import { defineEventHandler, getRequestURL, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { ProtectedResourceMetadata } from './types'
import { getMcpConfig } from '../config'

/**
 * Protected Resource Metadata endpoint handler (RFC9728)
 * Serves metadata at /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/{path}
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const config = getMcpConfig(runtimeConfig.mcp)

  // Get the request URL to derive resource and authorization server
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const mcpRoute = config.route || '/mcp'

  // Build the resource identifier (the MCP endpoint URL)
  const resource = config.oauth?.resource || `${origin}${mcpRoute}`

  // Authorization server (defaults to same origin)
  const authorizationServer = config.oauth?.authorizationServer || origin

  // Scopes supported
  const scopes = config.oauth?.scopes || ['mcp:read', 'mcp:write']

  // Build Protected Resource Metadata response
  const metadata: ProtectedResourceMetadata = {
    resource,
    authorization_servers: [authorizationServer],
    scopes_supported: scopes,
    bearer_methods_supported: ['header'],
    resource_name: config.name || 'MCP Server',
  }

  // Set proper content type
  setResponseHeader(event, 'Content-Type', 'application/json')

  // Allow CORS for metadata discovery
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')

  return metadata
})
