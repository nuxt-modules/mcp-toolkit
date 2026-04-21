import { createMcpTransportHandler } from './types'
import { getHeader, toWebRequest } from '../compat'
import { validateOrigin } from './security'
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
  // `agents/mcp` accepts the SDK `McpServer` but its public type signature
  // pins a slightly older minor of `@modelcontextprotocol/sdk`. The runtime
  // contract is identical — we cast through `unknown` to dodge the
  // structurally-incompatible internal types without weakening the rest of
  // the file.
  const handler = createMcpHandler(server as unknown as Parameters<typeof createMcpHandler>[0], {
    route: '',
  })
  const request = toWebRequest(event)
  const cf = event.context.cloudflare as CloudflareContext | undefined
  return handler(request, cf?.env ?? {}, cf?.ctx ?? fallbackCtx)
})
