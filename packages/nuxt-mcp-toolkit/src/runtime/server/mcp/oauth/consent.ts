import { defineEventHandler, getQuery, getRequestURL, sendRedirect } from 'h3'
import { useRuntimeConfig } from '#imports'
import { getPendingAuthorization } from './authorize'
import { getMcpConfig } from '../config'
import { getMcpSession, hasMcpSessionProvider } from './session-provider'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const requestId = query.request_id as string
  const runtimeConfig = useRuntimeConfig(event)
  const config = getMcpConfig(runtimeConfig.mcp)
  const requestUrl = getRequestURL(event)
  const origin = `${requestUrl.protocol}//${requestUrl.host}`

  if (!requestId) {
    return sendRedirect(event, `/__mcp/oauth/consent?error=missing_request_id`)
  }

  const pending = getPendingAuthorization(requestId)
  if (!pending) {
    return sendRedirect(event, `/__mcp/oauth/consent?error=invalid_request`)
  }

  if (hasMcpSessionProvider()) {
    const userSession = await getMcpSession(event)

    if (!userSession) {
      const loginUrl = config.oauth?.loginUrl

      if (loginUrl) {
        const currentUrl = new URL(requestUrl)
        const returnUrl = currentUrl.pathname + currentUrl.search

        const loginRedirect = new URL(loginUrl, origin)
        loginRedirect.searchParams.set('redirect', returnUrl)

        return sendRedirect(event, loginRedirect.toString())
      }

      return sendRedirect(event, `/__mcp/oauth/consent?error=auth_required`)
    }
  }

  return sendRedirect(event, `/__mcp/oauth/consent?request_id=${encodeURIComponent(requestId)}`)
})
