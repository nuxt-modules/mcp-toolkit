/**
 * OAuth 2.0 Token Endpoint
 * RFC 6749 Section 4.1.3 - Access Token Request
 *
 * Exchanges authorization codes for access tokens.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
 */

import { defineEventHandler, readBody, getHeader, setResponseStatus, setResponseHeader } from 'h3'
import type { TokenRequest, TokenResponse, OAuthErrorResponse } from './types'
import {
  getClient,
  consumeAuthorizationCode,
  storeAccessToken,
  storeRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  generateRandomString,
  verifyCodeChallenge,
} from './storage'

// Token expiration time
const ACCESS_TOKEN_TTL = 60 * 60 * 1000 // 1 hour

export default defineEventHandler(async (event) => {
  // Only accept POST requests
  if (event.method !== 'POST') {
    setResponseStatus(event, 405)
    setResponseHeader(event, 'Allow', 'POST')
    return { error: 'invalid_request', error_description: 'Only POST method is allowed' }
  }

  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  setResponseHeader(event, 'Pragma', 'no-cache')

  let body: TokenRequest
  try {
    body = await readBody(event)
  }
  catch {
    setResponseStatus(event, 400)
    return {
      error: 'invalid_request',
      error_description: 'Invalid request body',
    } satisfies OAuthErrorResponse
  }

  // Handle different grant types
  if (body.grant_type === 'authorization_code') {
    return handleAuthorizationCodeGrant(event, body)
  }
  else if (body.grant_type === 'refresh_token') {
    return handleRefreshTokenGrant(event, body)
  }
  else {
    setResponseStatus(event, 400)
    return {
      error: 'unsupported_grant_type',
      error_description: `Unsupported grant_type: ${body.grant_type}`,
    } satisfies OAuthErrorResponse
  }
})

async function handleAuthorizationCodeGrant(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  body: TokenRequest,
): Promise<TokenResponse | OAuthErrorResponse> {
  // Validate required parameters
  if (!body.code) {
    setResponseStatus(event, 400)
    return { error: 'invalid_request', error_description: 'code is required' }
  }

  if (!body.redirect_uri) {
    setResponseStatus(event, 400)
    return { error: 'invalid_request', error_description: 'redirect_uri is required' }
  }

  // Get and consume the authorization code (one-time use)
  const authCode = await consumeAuthorizationCode(body.code)
  if (!authCode) {
    setResponseStatus(event, 400)
    return { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' }
  }

  // Validate redirect_uri matches
  if (body.redirect_uri !== authCode.redirect_uri) {
    setResponseStatus(event, 400)
    return { error: 'invalid_grant', error_description: 'redirect_uri does not match' }
  }

  // Get the client
  const client = await getClient(authCode.client_id)
  if (!client) {
    setResponseStatus(event, 400)
    return { error: 'invalid_client', error_description: 'Client not found' }
  }

  // Authenticate the client
  const clientAuthError = authenticateClient(event, body, client)
  if (clientAuthError) {
    setResponseStatus(event, 401)
    setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="OAuth"')
    return clientAuthError
  }

  // Verify PKCE code_verifier if code_challenge was used
  if (authCode.code_challenge) {
    if (!body.code_verifier) {
      setResponseStatus(event, 400)
      return { error: 'invalid_request', error_description: 'code_verifier is required' }
    }

    const valid = await verifyCodeChallenge(
      body.code_verifier,
      authCode.code_challenge,
      authCode.code_challenge_method || 'S256',
    )

    if (!valid) {
      setResponseStatus(event, 400)
      return { error: 'invalid_grant', error_description: 'Invalid code_verifier' }
    }
  }

  // Generate tokens
  const accessToken = generateRandomString(64)
  const refreshToken = generateRandomString(64)

  // Store access token
  await storeAccessToken({
    token: accessToken,
    client_id: client.client_id,
    scope: authCode.scope,
    user_id: authCode.user_id,
    user_data: authCode.user_data,
    expires_at: Date.now() + ACCESS_TOKEN_TTL,
    created_at: Date.now(),
  })

  // Store refresh token
  await storeRefreshToken(refreshToken, {
    client_id: client.client_id,
    scope: authCode.scope,
    user_id: authCode.user_id,
    user_data: authCode.user_data,
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL / 1000),
    refresh_token: refreshToken,
    scope: authCode.scope,
  }
}

async function handleRefreshTokenGrant(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  body: TokenRequest,
): Promise<TokenResponse | OAuthErrorResponse> {
  if (!body.refresh_token) {
    setResponseStatus(event, 400)
    return { error: 'invalid_request', error_description: 'refresh_token is required' }
  }

  const storedRefreshToken = await getRefreshToken(body.refresh_token)
  if (!storedRefreshToken) {
    setResponseStatus(event, 400)
    return { error: 'invalid_grant', error_description: 'Invalid refresh token' }
  }

  // Get the client
  const client = await getClient(storedRefreshToken.client_id)
  if (!client) {
    setResponseStatus(event, 400)
    return { error: 'invalid_client', error_description: 'Client not found' }
  }

  // Authenticate the client
  const clientAuthError = authenticateClient(event, body, client)
  if (clientAuthError) {
    setResponseStatus(event, 401)
    setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="OAuth"')
    return clientAuthError
  }

  // Revoke old refresh token (rotation)
  await revokeRefreshToken(body.refresh_token)

  // Generate new tokens
  const accessToken = generateRandomString(64)
  const newRefreshToken = generateRandomString(64)

  // Store new access token
  await storeAccessToken({
    token: accessToken,
    client_id: client.client_id,
    scope: storedRefreshToken.scope,
    user_id: storedRefreshToken.user_id,
    user_data: storedRefreshToken.user_data,
    expires_at: Date.now() + ACCESS_TOKEN_TTL,
    created_at: Date.now(),
  })

  // Store new refresh token
  await storeRefreshToken(newRefreshToken, {
    client_id: client.client_id,
    scope: storedRefreshToken.scope,
    user_id: storedRefreshToken.user_id,
    user_data: storedRefreshToken.user_data,
  })

  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TOKEN_TTL / 1000),
    refresh_token: newRefreshToken,
    scope: storedRefreshToken.scope,
  }
}

function authenticateClient(
  event: Parameters<typeof defineEventHandler>[0] extends (e: infer E) => unknown ? E : never,
  body: TokenRequest,
  client: import('./types').OAuthClient,
): OAuthErrorResponse | null {
  // Public clients don't need authentication
  if (client.token_endpoint_auth_method === 'none') {
    // Just verify the client_id matches
    if (body.client_id && body.client_id !== client.client_id) {
      return { error: 'invalid_client', error_description: 'Client ID mismatch' }
    }
    return null
  }

  // Check for client_secret_basic (Authorization header)
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Basic ')) {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
    const [clientId, clientSecret] = credentials.split(':')

    if (clientId !== client.client_id || clientSecret !== client.client_secret) {
      return { error: 'invalid_client', error_description: 'Invalid client credentials' }
    }
    return null
  }

  // Check for client_secret_post (body parameters)
  if (body.client_id && body.client_secret) {
    if (body.client_id !== client.client_id || body.client_secret !== client.client_secret) {
      return { error: 'invalid_client', error_description: 'Invalid client credentials' }
    }
    return null
  }

  return { error: 'invalid_client', error_description: 'Client authentication required' }
}
