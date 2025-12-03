/**
 * OAuth 2.0 Authorization Endpoint
 * RFC 6749 Section 4.1.1 - Authorization Request
 *
 * This endpoint handles the authorization request from MCP clients.
 * It validates the request and redirects to your consent page.
 *
 * Configure `mcp.oauth.consentUrl` to specify your custom consent/login page.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
 */

import { defineEventHandler, getQuery, sendRedirect, setResponseHeader, getRequestURL, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import type { AuthorizationRequest, OAuthErrorResponse } from './types'
import { getClient, storeAuthorizationCode, generateRandomString } from './storage'
import { getMcpConfig } from '../config'

/**
 * Pending authorization request data
 * This is what you'll receive when calling `getPendingAuthorization(requestId)`
 */
export interface PendingAuthorization {
  /** The MCP client's ID */
  client_id: string
  /** Where to redirect after authorization */
  redirect_uri: string
  /** Requested OAuth scopes */
  scope?: string
  /** Client state parameter (must be returned unchanged) */
  state?: string
  /** PKCE code challenge */
  code_challenge?: string
  /** PKCE code challenge method */
  code_challenge_method?: 'S256' | 'plain'
  /** When this request was created */
  created_at: number
}

// Store pending authorization requests (to be completed after user login)
const pendingAuthorizations = new Map<string, PendingAuthorization>()

// Clean up expired pending authorizations (10 min TTL)
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of pendingAuthorizations.entries()) {
    if (now - value.created_at > 10 * 60 * 1000) {
      pendingAuthorizations.delete(key)
    }
  }
}, 60 * 1000)

export function getPendingAuthorization(requestId: string) {
  return pendingAuthorizations.get(requestId)
}

export function deletePendingAuthorization(requestId: string) {
  pendingAuthorizations.delete(requestId)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as unknown as AuthorizationRequest
  const runtimeConfig = useRuntimeConfig(event)
  const config = getMcpConfig(runtimeConfig.mcp)
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`

  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Pragma', 'no-cache')

  // Validate response_type
  if (query.response_type !== 'code') {
    const error: OAuthErrorResponse = {
      error: 'invalid_request',
      error_description: 'response_type must be "code"',
    }

    if (query.redirect_uri && query.state) {
      const errorUrl = new URL(query.redirect_uri)
      errorUrl.searchParams.set('error', error.error)
      errorUrl.searchParams.set('error_description', error.error_description!)
      errorUrl.searchParams.set('state', query.state)
      return sendRedirect(event, errorUrl.toString())
    }

    throw createError({ statusCode: 400, data: error })
  }

  // Validate client_id
  if (!query.client_id) {
    throw createError({
      statusCode: 400,
      data: { error: 'invalid_request', error_description: 'client_id is required' },
    })
  }

  const client = await getClient(query.client_id)
  if (!client) {
    throw createError({
      statusCode: 400,
      data: { error: 'invalid_client', error_description: 'Unknown client_id' },
    })
  }

  // Validate redirect_uri
  const redirectUri = query.redirect_uri || client.redirect_uris[0]
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    throw createError({
      statusCode: 400,
      data: { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
    })
  }

  // PKCE is required for public clients (MCP requirement)
  if (client.token_endpoint_auth_method === 'none' && !query.code_challenge) {
    const errorUrl = new URL(redirectUri)
    errorUrl.searchParams.set('error', 'invalid_request')
    errorUrl.searchParams.set('error_description', 'code_challenge is required for public clients')
    if (query.state) errorUrl.searchParams.set('state', query.state)
    return sendRedirect(event, errorUrl.toString())
  }

  // Validate code_challenge_method (must be S256 per MCP spec)
  if (query.code_challenge && query.code_challenge_method !== 'S256') {
    const errorUrl = new URL(redirectUri)
    errorUrl.searchParams.set('error', 'invalid_request')
    errorUrl.searchParams.set('error_description', 'code_challenge_method must be S256')
    if (query.state) errorUrl.searchParams.set('state', query.state)
    return sendRedirect(event, errorUrl.toString())
  }

  // Generate a unique request ID to track this authorization
  const requestId = generateRandomString(32)

  // Store pending authorization
  pendingAuthorizations.set(requestId, {
    client_id: query.client_id,
    redirect_uri: redirectUri,
    scope: query.scope,
    state: query.state,
    code_challenge: query.code_challenge,
    code_challenge_method: query.code_challenge_method || 'S256',
    created_at: Date.now(),
  })

  // Build the consent page URL
  // Use custom consent URL if configured, otherwise use built-in consent page
  const mcpRoute = config.route || '/mcp'
  const customConsentUrl = config.oauth?.consentUrl
  const consentPath = customConsentUrl || `${mcpRoute}/oauth/consent`

  // Build full URL (handle both absolute and relative paths)
  const authPageUrl = consentPath.startsWith('http')
    ? new URL(consentPath)
    : new URL(`${origin}${consentPath}`)

  // Add query parameters for the consent page
  authPageUrl.searchParams.set('request_id', requestId)
  authPageUrl.searchParams.set('client_id', query.client_id)
  if (client.client_name) {
    authPageUrl.searchParams.set('client_name', client.client_name)
  }
  if (query.scope) {
    authPageUrl.searchParams.set('scope', query.scope)
  }

  return sendRedirect(event, authPageUrl.toString())
})

/**
 * Complete the authorization flow after user consent
 * Call this from your consent page handler after the user approves
 */
export async function completeAuthorization(
  requestId: string,
  approved: boolean,
  userData?: { user_id?: string, user_data?: Record<string, unknown> },
): Promise<{ redirectUrl: string } | { error: string }> {
  const pending = pendingAuthorizations.get(requestId)
  if (!pending) {
    return { error: 'Invalid or expired authorization request' }
  }

  pendingAuthorizations.delete(requestId)

  const redirectUrl = new URL(pending.redirect_uri)

  if (!approved) {
    redirectUrl.searchParams.set('error', 'access_denied')
    redirectUrl.searchParams.set('error_description', 'User denied the authorization request')
    if (pending.state) redirectUrl.searchParams.set('state', pending.state)
    return { redirectUrl: redirectUrl.toString() }
  }

  // Generate authorization code
  const code = generateRandomString(48)

  // Store the authorization code (expires in 10 minutes)
  await storeAuthorizationCode({
    code,
    client_id: pending.client_id,
    redirect_uri: pending.redirect_uri,
    scope: pending.scope,
    code_challenge: pending.code_challenge,
    code_challenge_method: pending.code_challenge_method,
    user_id: userData?.user_id,
    user_data: userData?.user_data,
    expires_at: Date.now() + 10 * 60 * 1000, // 10 minutes
    created_at: Date.now(),
  })

  // Redirect with authorization code
  redirectUrl.searchParams.set('code', code)
  if (pending.state) redirectUrl.searchParams.set('state', pending.state)

  return { redirectUrl: redirectUrl.toString() }
}
