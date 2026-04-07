import type { H3Event } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { getHeader } from './compat'

const INVALIDATED_AT_KEY = 'invalidatedAt'

function getSessionMetaStorage(sessionId: string) {
  return useStorage(`mcp:sessions-meta:${sessionId}`)
}

export function getRequestSessionId(event: H3Event): string | undefined {
  return getHeader(event, 'mcp-session-id')
}

export function requestSessionInvalidation(event: H3Event): boolean {
  const sessionId = getRequestSessionId(event)
  if (!sessionId) return false
  event.context._mcpInvalidateSession = true
  return true
}

export function isSessionInvalidationRequested(event: H3Event): boolean {
  return Boolean(event.context._mcpInvalidateSession)
}

export async function markSessionInvalidated(sessionId: string): Promise<void> {
  await getSessionMetaStorage(sessionId).setItem(INVALIDATED_AT_KEY, Date.now())
}

export async function isSessionInvalidated(sessionId: string): Promise<boolean> {
  const invalidatedAt = await getSessionMetaStorage(sessionId).getItem<number>(INVALIDATED_AT_KEY)
  return typeof invalidatedAt === 'number'
}

export async function clearSessionInvalidation(sessionId: string): Promise<void> {
  await getSessionMetaStorage(sessionId).clear()
}
