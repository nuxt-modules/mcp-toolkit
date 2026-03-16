import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { randomUUID } from 'uncrypto'
import { readBody, getHeader, getMethod } from 'h3'
// @ts-expect-error - Generated template
import config from '#nuxt-mcp-toolkit/config.mjs'
import { createMcpTransportHandler } from './types'

interface Session {
  server: McpServer
  transport: StreamableHTTPServerTransport
  lastAccessed: number
}

const sessions = new Map<string, Session>()

let cleanupInterval: ReturnType<typeof setInterval> | null = null

function ensureCleanup(maxDuration: number) {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastAccessed > maxDuration) {
        session.transport.close()
        session.server.close()
        sessions.delete(id)
      }
    }
    if (sessions.size === 0 && cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
  }, 60_000)
}

export default createMcpTransportHandler(async (createServer, event) => {
  const sessionsConfig = config.sessions
  const sessionsEnabled = sessionsConfig?.enabled ?? false

  if (!sessionsEnabled) {
    const server = createServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    event.node.res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    const body = await readBody(event)
    await transport.handleRequest(event.node.req, event.node.res, body)
    return
  }

  const maxDuration: number = sessionsConfig?.maxDuration ?? 30 * 60 * 1000
  const method = getMethod(event)
  const sessionId = getHeader(event, 'mcp-session-id')

  if (sessionId) {
    const session = sessions.get(sessionId)
    if (!session) {
      event.node.res.writeHead(404, { 'Content-Type': 'application/json' })
      event.node.res.end(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32_001, message: 'Session not found' },
        id: null,
      }))
      return
    }

    session.lastAccessed = Date.now()
    const body = method === 'POST' ? await readBody(event) : undefined
    await session.transport.handleRequest(event.node.req, event.node.res, body)
    return
  }

  const server = createServer()
  let sessionStored = false

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
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
    }
    server.close()
  }

  await server.connect(transport)
  const body = await readBody(event)
  await transport.handleRequest(event.node.req, event.node.res, body)

  if (!sessionStored) {
    transport.close()
    server.close()
  }
})
