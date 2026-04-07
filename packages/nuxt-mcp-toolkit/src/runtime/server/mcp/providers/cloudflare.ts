import { createMcpTransportHandler } from './types'
import { getHeader, toWebRequest } from '../compat'
import { validateOrigin } from './security'
import { isSessionInvalidated, isSessionInvalidationRequested, markSessionInvalidated } from '../session-state'
// @ts-expect-error - Generated template
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

export default createMcpTransportHandler(async (createServer, event) => {
  const securityConfig = config.security ?? {}
  const originError = validateOrigin(event, securityConfig)
  if (originError) return originError

  const sessionId = getHeader(event, 'mcp-session-id')
  if (sessionId && await isSessionInvalidated(sessionId)) {
    return createJsonRpcErrorResponse(404, -32_001, 'Session not found')
  }

  if (sessionId && isSessionInvalidationRequested(event)) {
    await markSessionInvalidated(sessionId)
  }

  const server = createServer()
  event.context._mcpServer = server
  const { createMcpHandler } = await import('agents/mcp')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = createMcpHandler(server as any, {
    route: '', // allow any route
  }) // version mismatch
  const request = toWebRequest(event)
  const cf = event.context.cloudflare as CloudflareContext | undefined
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
})
