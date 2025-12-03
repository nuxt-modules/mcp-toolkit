import type { H3Event } from 'h3'
import type { McpUserSession, McpGetSessionFn } from './types'

let sessionProvider: McpGetSessionFn | null = null

/**
 * Register a session provider function for MCP OAuth.
 * This function is idempotent - subsequent calls are ignored.
 *
 * @example
 * ```ts
 * // server/mcp/middleware.ts
 * import { auth } from '../utils/auth'
 *
 * // Configure session provider (called once, idempotent)
 * setMcpSessionProvider(async (event) => {
 *   const session = await auth.api.getSession({ headers: event.headers })
 *   return session ? { user: session.user } : null
 * })
 *
 * export default defineEventHandler(async (event) => {
 *   // Your auth logic here...
 * })
 * ```
 */
export function setMcpSessionProvider(provider: McpGetSessionFn): void {
  // Idempotent - ignore subsequent calls
  if (sessionProvider !== null) return
  sessionProvider = provider
}

/**
 * Get the current user session using the registered provider.
 */
export async function getMcpSession(event: H3Event): Promise<McpUserSession | null> {
  if (!sessionProvider) {
    return null
  }

  try {
    return await sessionProvider(event)
  }
  catch (error) {
    console.error('[MCP OAuth] Error getting session:', error)
    return null
  }
}

/**
 * Check if a session provider has been registered.
 */
export function hasMcpSessionProvider(): boolean {
  return sessionProvider !== null
}
