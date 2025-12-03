import type { EventHandler } from 'h3'

/**
 * MCP Middleware type - a function that runs before MCP requests are processed.
 * Can be used for authentication, logging, rate limiting, etc.
 *
 * To use, create a `middleware.ts` file in your `server/mcp/` directory.
 *
 * **Important**: According to MCP Authorization spec, authentication errors
 * (401/403) MUST be returned from the middleware before any MCP processing.
 * Do NOT check authentication inside individual tools.
 *
 * The middleware can:
 * - Validate Bearer tokens from Authorization header
 * - Validate session cookies
 * - Check API keys
 * - Populate event.context.mcp with user/session data for tools to access
 *
 * @example Bearer token validation
 * ```ts
 * // server/mcp/middleware.ts
 * import { extractBearerToken } from '@nuxtjs/mcp-toolkit'
 *
 * export default defineEventHandler(async (event) => {
 *   const token = extractBearerToken(event)
 *
 *   if (!token) {
 *     throw createError({ statusCode: 401, message: 'Bearer token required' })
 *   }
 *
 *   // Validate token (JWT, introspection, or database lookup)
 *   const user = await validateToken(token)
 *
 *   if (!user) {
 *     throw createError({ statusCode: 401, message: 'Invalid token' })
 *   }
 *
 *   // Store user in context for tools to access
 *   event.context.mcp = { user }
 * })
 * ```
 *
 * @example Session-based auth (better-auth)
 * ```ts
 * // server/mcp/middleware.ts
 * export default defineEventHandler(async (event) => {
 *   const session = await auth.api.getSession({ headers: event.headers })
 *
 *   if (!session) {
 *     throw createError({ statusCode: 401, message: 'Authentication required' })
 *   }
 *
 *   event.context.mcp = { session, user: session.user }
 * })
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
 */
export type McpMiddleware = EventHandler
