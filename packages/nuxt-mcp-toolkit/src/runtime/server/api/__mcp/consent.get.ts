import { defineEventHandler, getQuery, getRequestURL, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getPendingAuthorization } from '../../mcp/oauth/authorize'
import { getClient } from '../../mcp/oauth/storage'
import { getMcpConfig } from '../../mcp/config'
import { getMcpSession, hasMcpSessionProvider } from '../../mcp/oauth/session-provider'

const scopeLabels: Record<string, string> = {
  'mcp:read': 'Read MCP tools and resources',
  'mcp:write': 'Execute MCP tools',
  'openid': 'Basic profile information',
  'profile': 'Profile details',
  'email': 'Email address',
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestId = query.request_id as string

  if (!requestId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Missing request_id parameter',
    })
  }

  const pending = getPendingAuthorization(requestId)
  if (!pending) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid or expired authorization request',
    })
  }

  const runtimeConfig = useRuntimeConfig(event)
  const config = getMcpConfig(runtimeConfig.mcp)
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`
  const mcpRoute = config.route || '/mcp'

  const client = await getClient(pending.client_id)
  const clientName = client?.client_name || pending.client_id
  const scopes = pending.scope?.split(' ').filter(Boolean) || []

  let user: { id: string, name?: string, email?: string, image?: string } | null = null

  if (hasMcpSessionProvider()) {
    const session = await getMcpSession(event)
    if (session?.user) {
      user = session.user
    }
  }

  return {
    requestId,
    clientName,
    appName: config.name || 'MCP Server',
    callbackUrl: `${origin}${mcpRoute}/oauth/callback`,
    scopes: scopes.length > 0
      ? scopes.map(s => ({ key: s, label: scopeLabels[s] || s }))
      : [{ key: 'basic', label: 'Basic MCP access' }],
    user,
  }
})
