/**
 * MCP Authentication Middleware
 *
 * Validates Bearer tokens from MCP clients (Cursor, Claude Desktop).
 * The session provider is configured for the OAuth consent flow.
 */
import { auth } from '../utils/auth'

// Session provider for OAuth consent flow (used by consent page to identify user)
setMcpSessionProvider(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session) return null
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? undefined,
    },
  }
})

export default defineEventHandler(async (event) => {
  const bearerToken = extractBearerToken(event)

  if (!bearerToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Bearer token required',
    })
  }

  const accessToken = getAccessToken(bearerToken)

  if (!accessToken) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Invalid or expired access token',
    })
  }

  event.context.mcp = {
    user: accessToken.user_data,
    user_id: accessToken.user_id,
    scope: accessToken.scope,
  }
})
