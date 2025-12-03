/**
 * MCP OAuth Types
 * Based on RFC9728 (Protected Resource Metadata) and RFC8414 (Authorization Server Metadata)
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */

import type { H3Event } from 'h3'

/**
 * User session returned by the getSession hook
 */
export interface McpUserSession {
  user: {
    id: string
    name?: string
    email?: string
    image?: string
  }
}

/**
 * Type for the getSession hook function
 */
export type McpGetSessionFn = (event: H3Event) => Promise<McpUserSession | null>

/**
 * OAuth configuration for the MCP module
 */
export interface McpOAuthConfig {
  /**
   * Enable OAuth authentication for MCP server
   * @default false (auto-enabled if middleware exists)
   */
  enabled?: boolean

  /**
   * URL of the login page to redirect to when user is not authenticated.
   * The toolkit will append a `redirect` query parameter with the return URL.
   *
   * @example '/login' or '/auth/signin'
   * @default undefined (uses built-in consent page without login redirect)
   */
  loginUrl?: string

  /**
   * The canonical resource identifier for this MCP server
   * Used in Protected Resource Metadata
   * @default Automatically derived from request URL
   */
  resource?: string

  /**
   * Authorization server URL
   * @default Same origin as the MCP server
   */
  authorizationServer?: string

  /**
   * Scopes supported by this MCP server
   * @default ['mcp:read', 'mcp:write']
   */
  scopes?: string[]

  /**
   * Custom consent/login page URL.
   * The user will be redirected here to authenticate and approve the MCP client.
   *
   * Query parameters passed to this URL:
   * - `request_id`: Unique ID for this authorization request (required to complete the flow)
   * - `client_id`: The MCP client's ID
   * - `client_name`: The MCP client's display name (if provided)
   * - `scope`: Requested scopes (space-separated)
   *
   * Your page should:
   * 1. Authenticate the user (e.g., redirect to login if not logged in)
   * 2. Show consent UI with client name and requested scopes
   * 3. Call `completeAuthorization(requestId, approved, userData)` to finish
   *
   * @example '/mcp/consent' or '/auth/mcp-authorize'
   * @default Built-in consent page at '/mcp/oauth/consent'
   */
  consentUrl?: string

  /**
   * Custom OAuth endpoints (for integration with existing auth like better-auth)
   */
  endpoints?: {
    /**
     * Authorization endpoint path
     * @default '/api/auth/authorize'
     */
    authorization?: string

    /**
     * Token endpoint path
     * @default '/api/auth/token'
     */
    token?: string

    /**
     * Token introspection endpoint (optional)
     */
    introspection?: string

    /**
     * Dynamic client registration endpoint (optional)
     */
    registration?: string
  }

  /**
   * Bearer token validation method
   * - 'jwt': Validate JWT tokens locally
   * - 'introspection': Use token introspection endpoint
   * - 'custom': Use custom validation via middleware
   * @default 'custom'
   */
  tokenValidation?: 'jwt' | 'introspection' | 'custom'

  /**
   * JWT validation options (when tokenValidation is 'jwt')
   */
  jwt?: {
    /**
     * Secret key for HS256 or public key for RS256
     */
    secret?: string

    /**
     * Expected audience claim
     */
    audience?: string

    /**
     * Expected issuer claim
     */
    issuer?: string
  }
}

/**
 * Protected Resource Metadata (RFC9728)
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
export interface ProtectedResourceMetadata {
  /**
   * The protected resource's resource indicator value
   */
  resource: string

  /**
   * Array of authorization server URLs that can issue tokens for this resource
   */
  authorization_servers: string[]

  /**
   * JSON Web Key Set document containing the resource's public keys
   */
  jwks_uri?: string

  /**
   * Array of OAuth 2.0 scope values that are used at this resource
   */
  scopes_supported?: string[]

  /**
   * Methods supported for sending bearer tokens
   */
  bearer_methods_supported?: ('header' | 'body' | 'query')[]

  /**
   * Supported signing algorithms for signed requests
   */
  resource_signing_alg_values_supported?: string[]

  /**
   * Human-readable name of the resource
   */
  resource_name?: string

  /**
   * URL of documentation for the resource
   */
  resource_documentation?: string

  /**
   * URL of a page with policy information
   */
  resource_policy_uri?: string

  /**
   * URL of a page with terms of service
   */
  resource_tos_uri?: string
}

/**
 * Authorization Server Metadata (RFC8414)
 * @see https://datatracker.ietf.org/doc/html/rfc8414
 */
export interface AuthorizationServerMetadata {
  /**
   * The authorization server's issuer identifier
   */
  issuer: string

  /**
   * URL of the authorization endpoint
   */
  authorization_endpoint: string

  /**
   * URL of the token endpoint
   */
  token_endpoint: string

  /**
   * URL of the token introspection endpoint (optional)
   */
  introspection_endpoint?: string

  /**
   * URL of the dynamic client registration endpoint (optional)
   */
  registration_endpoint?: string

  /**
   * JSON Web Key Set URL
   */
  jwks_uri?: string

  /**
   * Array of supported scope values
   */
  scopes_supported?: string[]

  /**
   * Array of supported response types
   */
  response_types_supported: string[]

  /**
   * Array of supported grant types
   */
  grant_types_supported?: string[]

  /**
   * Array of supported token endpoint authentication methods
   */
  token_endpoint_auth_methods_supported?: string[]

  /**
   * Array of supported PKCE code challenge methods
   * MCP requires S256 support
   */
  code_challenge_methods_supported: string[]

  /**
   * Service documentation URL
   */
  service_documentation?: string
}

/**
 * WWW-Authenticate challenge parameters
 */
export interface WWWAuthenticateParams {
  /**
   * URL to the protected resource metadata
   */
  resource_metadata: string

  /**
   * Required scope(s) for the request
   */
  scope?: string

  /**
   * Error code
   */
  error?: 'invalid_token' | 'insufficient_scope' | 'invalid_request'

  /**
   * Human-readable error description
   */
  error_description?: string
}

// ============================================
// OAuth 2.1 Flow Types (RFC 6749 / RFC 7636)
// ============================================

/**
 * Dynamic Client Registration Request (RFC 7591)
 */
export interface ClientRegistrationRequest {
  /**
   * Array of redirect URIs
   */
  redirect_uris: string[]

  /**
   * Human-readable client name
   */
  client_name?: string

  /**
   * URL of client homepage
   */
  client_uri?: string

  /**
   * URL of client logo
   */
  logo_uri?: string

  /**
   * Grant types the client will use
   */
  grant_types?: string[]

  /**
   * Response types the client will use
   */
  response_types?: string[]

  /**
   * Scope values the client will request
   */
  scope?: string

  /**
   * Token endpoint auth method
   */
  token_endpoint_auth_method?: string
}

/**
 * Registered OAuth Client
 */
export interface OAuthClient {
  client_id: string
  client_secret?: string
  client_name?: string
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  scope?: string
  token_endpoint_auth_method: string
  created_at: number
}

/**
 * Client Registration Response (RFC 7591)
 */
export interface ClientRegistrationResponse {
  client_id: string
  client_secret?: string
  client_id_issued_at?: number
  client_secret_expires_at?: number
  redirect_uris: string[]
  grant_types: string[]
  response_types: string[]
  token_endpoint_auth_method: string
}

/**
 * Authorization Request (RFC 6749 Section 4.1.1)
 */
export interface AuthorizationRequest {
  response_type: 'code'
  client_id: string
  redirect_uri?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: 'S256' | 'plain'
}

/**
 * Stored Authorization Code
 */
export interface AuthorizationCode {
  code: string
  client_id: string
  redirect_uri: string
  scope?: string
  code_challenge?: string
  code_challenge_method?: 'S256' | 'plain'
  user_id?: string
  user_data?: Record<string, unknown>
  expires_at: number
  created_at: number
}

/**
 * Token Request (RFC 6749 Section 4.1.3)
 */
export interface TokenRequest {
  grant_type: 'authorization_code' | 'refresh_token'
  code?: string
  redirect_uri?: string
  client_id?: string
  client_secret?: string
  code_verifier?: string
  refresh_token?: string
  scope?: string
}

/**
 * Access Token
 */
export interface AccessToken {
  token: string
  client_id: string
  scope?: string
  user_id?: string
  user_data?: Record<string, unknown>
  expires_at: number
  created_at: number
}

/**
 * Token Response (RFC 6749 Section 4.1.4)
 */
export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope?: string
}

/**
 * OAuth Error Response (RFC 6749 Section 4.1.2.1)
 */
export interface OAuthErrorResponse {
  error: 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unauthorized_client' | 'unsupported_grant_type' | 'invalid_scope' | 'access_denied' | 'server_error'
  error_description?: string
  error_uri?: string
}
