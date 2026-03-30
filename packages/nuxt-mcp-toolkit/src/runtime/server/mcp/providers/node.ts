import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { useStorage } from 'nitropack/runtime'
import { getHeader, toWebRequest } from '../compat'
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

function ensureCleanup(maxDuration: number) {
  if (cleanupInterval) return
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [id, session] of sessions) {
      if (now - session.lastAccessed > maxDuration) {
        session.transport.close()
        session.server.close()
        sessions.delete(id)
        useStorage(`mcp:sessions:${id}`).clear()
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
  const request = await toWebRequest(event)

  if (!sessionsEnabled) {
    const server = createServer()
    event.context._mcpServer = server
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    event.node.res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    return transport.handleRequest(request)
  }

  const maxDuration: number = sessionsConfig?.maxDuration ?? 30 * 60 * 1000
  const sessionId = getHeader(event, 'mcp-session-id')

  if (sessionId) {
    const session = sessions.get(sessionId)
    if (!session) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32_001, message: 'Session not found' },
        id: null,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    session.lastAccessed = Date.now()
    event.context._mcpServer = session.server
    return session.transport.handleRequest(request)
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
      useStorage(`mcp:sessions:${sid}`).clear()
    }
    server.close()
  }

  await server.connect(transport)
  const response = await transport.handleRequest(request)

  if (!sessionStored) {
    event.node.res.on('close', () => {
      transport.close()
      server.close()
    })
  }

  return response
})
