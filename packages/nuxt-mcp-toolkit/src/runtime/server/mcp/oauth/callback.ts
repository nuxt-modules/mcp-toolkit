import { defineEventHandler, readBody, sendRedirect, setResponseHeader, createError } from 'h3'
import { completeAuthorization } from './authorize'
import { getMcpSession } from './session-provider'

export default defineEventHandler(async (event) => {
  if (event.method !== 'POST') {
    setResponseHeader(event, 'Allow', 'POST')
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
  }

  const body = await readBody(event)
  const requestId = body.request_id as string
  const approved = body.approved === 'true' || body.approved === true

  if (!requestId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing request_id' })
  }

  let userData: { user_id: string, user_data: Record<string, unknown> } | undefined

  const session = await getMcpSession(event)
  if (session?.user) {
    userData = {
      user_id: session.user.id,
      user_data: session.user as Record<string, unknown>,
    }
  }

  const result = await completeAuthorization(requestId, approved, userData)

  if ('error' in result) {
    throw createError({ statusCode: 400, statusMessage: result.error })
  }

  return sendRedirect(event, result.redirectUrl)
})
