import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createMcpTransportHandler } from './types'
import { getHeader, toWebRequest } from '../compat'
import { isValidSessionId, validateOrigin } from './security'
import { isSessionInvalidated, isSessionInvalidationRequested, markSessionInvalidated } from '../session-state'
import config from '#nuxt-mcp-toolkit/config.mjs'

interface CloudflareContext {
  env: Record<string, unknown>
  ctx: ExecutionContext
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

const fallbackCtx: ExecutionContext = {
  waitUntil: () => {},
  passThroughOnException: () => {},
}

function createJsonRpcErrorResponse(status: number, code: number, message: string): Response {
  return new Response(JSON.stringify({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function checkCloudflareSession(sessionId: string | undefined, invalidationRequested: boolean): Promise<Response | null> {
  if (!sessionId) return null

  // The id becomes part of a storage key, so it must not reach `useStorage` unchecked.
  if (!isValidSessionId(sessionId)) {
    return createJsonRpcErrorResponse(400, -32_600, 'Invalid session ID format')
  }

  if (await isSessionInvalidated(sessionId)) {
    return createJsonRpcErrorResponse(404, -32_001, 'Session not found')
  }

  if (invalidationRequested) {
    await markSessionInvalidated(sessionId)
  }

  return null
}

export async function handleCloudflareRequest(createServer: () => McpServer, request: Request, cf?: CloudflareContext): Promise<Response> {
  // `createMcpHandler` deprecates SDK v1 servers and rejects one from an SDK copy other than
  // its own — `agents` pins an exact SDK version. The legacy handler takes any v1 server.
  const { createLegacyMcpHandler } = await import('agents/mcp')
  const handler = createLegacyMcpHandler(createServer(), { route: '' })
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
}

export default createMcpTransportHandler(async (createServer, event) => {
  const securityConfig = config.security ?? {}
  const originError = validateOrigin(event, securityConfig)
  if (originError) return originError

  const sessionError = await checkCloudflareSession(getHeader(event, 'mcp-session-id'), isSessionInvalidationRequested(event))
  if (sessionError) return sessionError

  return handleCloudflareRequest(() => {
    const server = createServer()
    event.context._mcpServer = server
    return server
  }, toWebRequest(event), event.context.cloudflare as CloudflareContext | undefined)
})
