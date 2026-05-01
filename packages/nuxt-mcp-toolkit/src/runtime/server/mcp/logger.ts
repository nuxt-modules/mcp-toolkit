import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js'
import { useEvent } from 'nitropack/runtime'
import type { H3Event } from 'h3'
import { getHeader } from './compat'
import { useMcpServer } from './server'
import { getEvlogLogger, getSdkServerFromHelper } from './internals'

/**
 * Sends `notifications/message` to the connected MCP client. Honours the
 * client's `logging/setLevel` per session and never throws — disconnects
 * and filtered levels are silently dropped.
 */
export interface McpClientNotifier {
  (level: LoggingLevel, data: unknown, logger?: string): Promise<void>
  debug: (data: unknown, logger?: string) => Promise<void>
  info: (data: unknown, logger?: string) => Promise<void>
  warning: (data: unknown, logger?: string) => Promise<void>
  error: (data: unknown, logger?: string) => Promise<void>
}

/**
 * Structural shape of evlog's per-request logger — kept narrow so the
 * toolkit doesn't pull `evlog` into its public types.
 */
export interface McpRequestLogger {
  set: (fields: Record<string, unknown>) => void
  info: (name: string, fields?: Record<string, unknown>) => void
  warn: (name: string, fields?: Record<string, unknown>) => void
  error: (name: string, fields?: Record<string, unknown>) => void
  getContext: () => Record<string, unknown>
  emit?: (...args: unknown[]) => unknown
  fork?: (...args: unknown[]) => unknown
}

/**
 * Split-channel logger. `notify` goes to the connected client (Cursor,
 * Claude, Inspector). `set` / `event` / `setUser` / `setSession` / `evlog`
 * feed the request's wide event (dev terminal + drains). The server channel
 * throws `McpObservabilityNotEnabledError` when `evlog/nuxt` is not registered.
 */
export interface McpLogger {
  notify: McpClientNotifier
  set: (fields: Record<string, unknown>) => void
  event: (name: string, fields?: Record<string, unknown>) => void
  setUser: (user: McpUserFields) => void
  setSession: (session: McpSessionFields) => void
  evlog: McpRequestLogger
}

export interface McpUserFields {
  id?: string | number
  email?: string
  name?: string
  [key: string]: unknown
}

export interface McpSessionFields {
  id?: string | number
  [key: string]: unknown
}

const OBSERVABILITY_HINT
  = 'Server-side observability is not active on this request. '
    + 'Install `evlog` and add `\'evlog/nuxt\'` to `modules` in nuxt.config. '
    + '`log.notify.*` (client channel) keeps working without evlog.'

class McpObservabilityNotEnabledError extends Error {
  constructor() {
    super(OBSERVABILITY_HINT)
    this.name = 'McpObservabilityNotEnabledError'
  }
}

function safeEvent(): H3Event | null {
  try {
    return useEvent()
  }
  catch {
    return null
  }
}

/**
 * Request-scoped logger for tools / resources / prompts. Requires
 * `nitro.experimental.asyncContext: true`. The optional `prefix` becomes
 * the default `logger` field on every `notifications/message`.
 */
export function useMcpLogger(prefix?: string): McpLogger {
  const helper = useMcpServer()
  const sdkServer = getSdkServerFromHelper(helper)

  const event = safeEvent()
  const requestLogger = getEvlogLogger(event)

  // The SDK applies `logging/setLevel` per session id, so we forward the
  // current MCP session header to `sendLoggingMessage`.
  const sessionId = event ? (getHeader(event, 'mcp-session-id') ?? undefined) : undefined

  const sendNotify = async (level: LoggingLevel, data: unknown, logger?: string): Promise<void> => {
    try {
      await sdkServer.sendLoggingMessage({
        level,
        data,
        logger: logger ?? prefix,
      }, sessionId)
    }
    catch (err) {
      if (requestLogger) {
        try {
          requestLogger.warn('mcp logger notify failed', {
            mcp: { logger: logger ?? prefix, level },
            error: err instanceof Error ? err.message : String(err),
          })
        }
        catch {
          // Drain itself failed — stay silent to honor the no-throw contract.
        }
      }
    }
  }

  const notify = sendNotify as McpClientNotifier
  notify.debug = (data, logger) => sendNotify('debug', data, logger)
  notify.info = (data, logger) => sendNotify('info', data, logger)
  notify.warning = (data, logger) => sendNotify('warning', data, logger)
  notify.error = (data, logger) => sendNotify('error', data, logger)

  const requireRequestLogger = (): McpRequestLogger => {
    if (!requestLogger) throw new McpObservabilityNotEnabledError()
    return requestLogger
  }

  return {
    notify,
    set: fields => requireRequestLogger().set(fields),
    event: (name, fields) => requireRequestLogger().info(name, fields),
    setUser: user => requireRequestLogger().set({ user }),
    setSession: session => requireRequestLogger().set({ session }),
    get evlog() {
      return requireRequestLogger()
    },
  }
}

export { McpObservabilityNotEnabledError }
