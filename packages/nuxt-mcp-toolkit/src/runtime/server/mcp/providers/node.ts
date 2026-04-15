import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { H3Event } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { getHeader, toWebRequest } from '../compat'
import { validateOrigin, isValidSessionId } from './security'
import { clearSessionInvalidation, isSessionInvalidated, isSessionInvalidationRequested, markSessionInvalidated } from '../session-state'
// @ts-expect-error - Generated template
import config from '#nuxt-mcp-toolkit/config.mjs'
import { createMcpTransportHandler } from './types'

interface Session {
  server: McpServer
  transport: WebStandardStreamableHTTPServerTransport
  lastAccessed: number
}

const sessions = new Map<string, Session>()

let cleanupInterval: ReturnType<typeof setInterval> | null = null

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

async function deleteSession(sessionId: string): Promise<boolean> {
  const session = sessions.get(sessionId)
  if (!session) return false
  sessions.delete(sessionId)
  await Promise.all([
    useStorage(`mcp:sessions:${sessionId}`).clear(),
    clearSessionInvalidation(sessionId),
  ])
  session.transport.close()
  session.server.close()
  return true
}

function ensureCleanup(maxDuration: number) {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastAccessed > maxDuration) {
        void deleteSession(id)
      }
    }
    if (sessions.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }, 60_000)
}

function onResponseClose(event: H3Event, fn: () => void) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeRes = (event as any).node?.res
  if (nodeRes && typeof nodeRes.on === 'function') {
    nodeRes.on('close', fn)
  }
}

export default createMcpTransportHandler(async (createServer, event) => {
  const securityConfig = config.security ?? {}
  const originError = validateOrigin(event, securityConfig)
  if (originError) return originError

  const sessionsConfig = config.sessions
  const sessionsEnabled = sessionsConfig?.enabled ?? false
  const request = toWebRequest(event)

  if (!sessionsEnabled) {
    // In stateless mode the SDK opens an SSE ReadableStream that never
    // receives notifications or closes, causing serverless functions
    // (e.g. Vercel) to hit their execution timeout.
    if (request.method === 'GET') {
      return createJsonRpcErrorResponse(405, -32_000, 'Method not allowed. Use POST for MCP requests.')
    }

    const server = createServer()
    event.context._mcpServer = server
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    onResponseClose(event, () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    return transport.handleRequest(request)
  }

  const maxDuration: number = sessionsConfig?.maxDuration ?? 30 * 60 * 1000
  const sessionId = getHeader(event, 'mcp-session-id')

  if (sessionId) {
    if (!isValidSessionId(sessionId)) {
      return createJsonRpcErrorResponse(400, -32_600, 'Invalid session ID format')
    }

    if (await isSessionInvalidated(sessionId)) {
      if (!await deleteSession(sessionId)) {
        await clearSessionInvalidation(sessionId)
      }
      return createJsonRpcErrorResponse(404, -32_001, 'Session not found')
    }

    const session = sessions.get(sessionId)
    if (!session) {
      return createJsonRpcErrorResponse(404, -32_001, 'Session not found')
    }

    session.lastAccessed = Date.now()
    event.context._mcpServer = session.server

    if (isSessionInvalidationRequested(event)) {
      await markSessionInvalidated(sessionId)
      onResponseClose(event, () => {
        void deleteSession(sessionId)
      })
    }

    return session.transport.handleRequest(request)
  }

  const maxSessions: number = sessionsConfig?.maxSessions ?? 1000
  if (sessions.size >= maxSessions) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32_001, message: 'Server session limit reached' },
      id: null,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    })
  }

  const server = createServer()
  event.context._mcpServer = server
  let sessionStored = false

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => globalThis.crypto.randomUUID(),
    onsessioninitialized: (id: string) => {
      sessionStored = true
      sessions.set(id, { server, transport, lastAccessed: Date.now() })
      ensureCleanup(maxDuration)
    },
  })

  transport.onclose = () => {
    const sid = transport.sessionId
    if (sid && sessions.has(sid)) {
      sessions.delete(sid)
      void Promise.all([
        useStorage(`mcp:sessions:${sid}`).clear(),
        clearSessionInvalidation(sid),
      ])
    }
    // Do not call server.close() here: this runs during transport shutdown;
    // explicit cleanup uses deleteSession() (invalidation, idle expiry, duplicate guard).
  }

  await server.connect(transport)
  const response = await transport.handleRequest(request)

  if (!sessionStored) {
    onResponseClose(event, () => {
      transport.close()
      server.close()
    })
  }

  return response
})
