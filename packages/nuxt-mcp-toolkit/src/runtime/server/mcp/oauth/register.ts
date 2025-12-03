/**
 * OAuth 2.0 Dynamic Client Registration Endpoint
 * RFC 7591 - OAuth 2.0 Dynamic Client Registration Protocol
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7591
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization#2-3-dynamic-client-registration
 */

import { defineEventHandler, readBody, setResponseStatus, setResponseHeader } from 'h3'
import type { ClientRegistrationRequest, ClientRegistrationResponse, OAuthErrorResponse, OAuthClient } from './types'
import { registerClient, generateRandomString } from './storage'

export default defineEventHandler(async (event) => {
  // Only accept POST requests
  if (event.method !== 'POST') {
    setResponseStatus(event, 405)
    setResponseHeader(event, 'Allow', 'POST')
    return { error: 'method_not_allowed', error_description: 'Only POST method is allowed' }
  }

  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Pragma', 'no-cache')

  let body: ClientRegistrationRequest
  try {
    body = await readBody(event)
  }
  catch {
    setResponseStatus(event, 400)
    return {
      error: 'invalid_request',
      error_description: 'Invalid JSON body',
    } satisfies OAuthErrorResponse
  }

  // Validate required fields
  if (!body.redirect_uris || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    setResponseStatus(event, 400)
    return {
      error: 'invalid_request',
      error_description: 'redirect_uris is required and must be a non-empty array',
    } satisfies OAuthErrorResponse
  }

  // Validate redirect URIs
  for (const uri of body.redirect_uris) {
    try {
      const url = new URL(uri)
      // For MCP clients, we allow localhost URLs and custom schemes
      // In production, you might want to restrict this further
      if (!['http:', 'https:'].includes(url.protocol) && !uri.includes('://localhost')) {
        // Allow custom schemes for native apps
        if (!url.protocol.match(/^[a-z][a-z0-9+.-]*:$/i)) {
          setResponseStatus(event, 400)
          return {
            error: 'invalid_request',
            error_description: `Invalid redirect URI: ${uri}`,
          } satisfies OAuthErrorResponse
        }
      }
    }
    catch {
      setResponseStatus(event, 400)
      return {
        error: 'invalid_request',
        error_description: `Invalid redirect URI format: ${uri}`,
      } satisfies OAuthErrorResponse
    }
  }

  // Generate client credentials
  const clientId = generateRandomString(32)
  // For public clients (native apps, SPAs), we don't issue a client_secret
  // MCP clients are typically public clients
  const tokenEndpointAuthMethod = body.token_endpoint_auth_method || 'none'
  const clientSecret = tokenEndpointAuthMethod !== 'none' ? generateRandomString(48) : undefined

  // Create client record
  const client: OAuthClient = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types || ['authorization_code', 'refresh_token'],
    response_types: body.response_types || ['code'],
    scope: body.scope,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
    created_at: Date.now(),
  }

  // Store the client
  await registerClient(client)

  // Build response
  const response: ClientRegistrationResponse = {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: client.redirect_uris,
    grant_types: client.grant_types,
    response_types: client.response_types,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
  }

  // Only include client_secret for confidential clients
  if (clientSecret) {
    response.client_secret = clientSecret
    response.client_secret_expires_at = 0 // 0 means never expires
  }

  setResponseStatus(event, 201)
  return response
})
