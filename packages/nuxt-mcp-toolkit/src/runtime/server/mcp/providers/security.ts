import type { H3Event } from 'h3'
import { getRequestURL } from 'h3'
import type { McpSecurityConfig } from '../config'
import { getHeader } from '../compat'

const UUID_RE = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i

/**
 * Validate that a session ID is a valid UUID v4.
 */
export function isValidSessionId(id: string): boolean {
  return UUID_RE.test(id)
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  }
  catch {
    return null
  }
}

/**
 * Validate the Origin header against the allowed origins configuration.
 * Returns a 403 Response if the origin is rejected, or `null` if the request is allowed.
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/transports#security
 */
export function validateOrigin(event: H3Event, security: McpSecurityConfig): Response | null {
  // Wildcard disables origin checks (explicit opt-out)
  if (security.allowedOrigins === '*') {
    return null
  }

  const origin = getHeader(event, 'origin')

  // Requests without an Origin header are typically same-origin
  // (browsers attach Origin only to cross-origin or unsafe requests)
  if (!origin) {
    return null
  }

  const normalizedOrigin = normalizeOrigin(origin)
  if (!normalizedOrigin) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32_600, message: 'Origin not allowed' },
      id: null,
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (Array.isArray(security.allowedOrigins)) {
    // Explicit allowlist
    if (security.allowedOrigins.some(allowedOrigin => normalizeOrigin(allowedOrigin) === normalizedOrigin)) {
      return null
    }
  }
  else {
    // Default: same-origin enforcement — compare full origin including scheme and port.
    if (normalizedOrigin === getRequestURL(event).origin) {
      return null
    }
  }

  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32_600, message: 'Origin not allowed' },
    id: null,
  }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}
