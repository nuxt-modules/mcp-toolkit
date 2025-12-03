/**
 * OAuth storage for MCP using Nitro KV Storage
 *
 * Uses Nitro's built-in storage layer which can be configured
 * with different drivers (fs, redis, cloudflare-kv, etc.)
 *
 * @see https://nitro.build/guide/storage
 */

import type { OAuthClient, AuthorizationCode, AccessToken } from './types'
import { useStorage } from 'nitropack/runtime'

function getStorage() {
  return useStorage('mcp')
}

// ============================================
// Crypto Utilities
// ============================================

/**
 * Generate a cryptographically secure random string
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => chars[byte % chars.length]).join('')
}

/**
 * Generate a SHA256 hash for PKCE code challenge verification
 */
export async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = new Uint8Array(hashBuffer)
  // Base64URL encode
  return btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// ============================================
// Client Management
// ============================================

export async function registerClient(client: OAuthClient): Promise<void> {
  await getStorage().setItem(`clients:${client.client_id}`, client)
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  return await getStorage().getItem<OAuthClient>(`clients:${clientId}`)
}

// ============================================
// Authorization Code Management
// ============================================

export async function storeAuthorizationCode(code: AuthorizationCode): Promise<void> {
  await getStorage().setItem(`auth-codes:${code.code}`, code)
}

export async function getAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
  const authCode = await getStorage().getItem<AuthorizationCode>(`auth-codes:${code}`)
  if (!authCode) return null

  // Check if expired
  if (authCode.expires_at < Date.now()) {
    await getStorage().removeItem(`auth-codes:${code}`)
    return null
  }

  return authCode
}

export async function consumeAuthorizationCode(code: string): Promise<AuthorizationCode | null> {
  const authCode = await getAuthorizationCode(code)
  if (authCode) {
    await getStorage().removeItem(`auth-codes:${code}`)
  }
  return authCode
}

// ============================================
// Access Token Management
// ============================================

export async function storeAccessToken(token: AccessToken): Promise<void> {
  await getStorage().setItem(`access-tokens:${token.token}`, token)
}

export async function getAccessToken(token: string): Promise<AccessToken | null> {
  const accessToken = await getStorage().getItem<AccessToken>(`access-tokens:${token}`)
  if (!accessToken) return null

  // Check if expired
  if (accessToken.expires_at < Date.now()) {
    await getStorage().removeItem(`access-tokens:${token}`)
    return null
  }

  return accessToken
}

// ============================================
// Refresh Token Management
// ============================================

interface RefreshTokenData {
  token: string
  client_id: string
  scope?: string
  user_id?: string
  user_data?: Record<string, unknown>
}

export async function storeRefreshToken(
  token: string,
  data: { client_id: string, scope?: string, user_id?: string, user_data?: Record<string, unknown> },
): Promise<void> {
  await getStorage().setItem(`refresh-tokens:${token}`, { token, ...data })
}

export async function getRefreshToken(token: string): Promise<RefreshTokenData | null> {
  return await getStorage().getItem<RefreshTokenData>(`refresh-tokens:${token}`)
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await getStorage().removeItem(`refresh-tokens:${token}`)
}

// ============================================
// PKCE Verification
// ============================================

export async function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: 'S256' | 'plain' = 'S256',
): Promise<boolean> {
  if (method === 'plain') {
    return codeVerifier === codeChallenge
  }

  // S256: BASE64URL(SHA256(code_verifier)) == code_challenge
  const computed = await sha256(codeVerifier)
  return computed === codeChallenge
}
