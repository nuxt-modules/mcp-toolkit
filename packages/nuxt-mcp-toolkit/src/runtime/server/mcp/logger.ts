import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js'
import { useEvent } from 'nitropack/runtime'
import type { H3Event } from 'h3'
import { getHeader } from './compat'
import { useMcpServer } from './server'
import { getEvlogLogger, getSdkServerFromHelper } from './internals'

/**
 * Methods that send `notifications/message` to the connected MCP client
 * (Cursor, Claude Desktop, MCP Inspector, ...). They respect the level
 * the client opted into via `logging/setLevel` and are silently dropped
 * when the transport is gone.
 *
 * **These never appear in your terminal** — they go over the wire to
 * whoever is connected. Use `log.set()` / `log.event()` for server-side
 * observability.
 */
export interface McpClientNotifier {
  /** Send a `notifications/message` at an arbitrary level. */
  (level: LoggingLevel, data: unknown, logger?: string): Promise<void>
  /** Shortcut for `notify('debug', ...)`. */
  debug: (data: unknown, logger?: string) => Promise<void>
  /** Shortcut for `notify('info', ...)`. */
  info: (data: unknown, logger?: string) => Promise<void>
  /** Shortcut for `notify('warning', ...)`. */
  warning: (data: unknown, logger?: string) => Promise<void>
  /** Shortcut for `notify('error', ...)`. */
  error: (data: unknown, logger?: string) => Promise<void>
}

/**
 * Minimal shape of evlog's per-request logger. Kept structural so the
 * toolkit doesn't pull `evlog` into its public types — users get the
 * full type signature only when they install `evlog` themselves.
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
 * Split-channel logger for MCP servers.
 *
 * Two clearly separated channels:
 *
 * - `log.notify(...)` (and `.notify.info`, `.notify.warning`, ...): **client
 *   notifications** sent over the MCP transport. Visible in the MCP
 *   Inspector "Server Notifications" panel and to AI clients. Honours the
 *   per-session `logging/setLevel`. Always available, even without evlog.
 * - `log.set(...)` / `log.event(...)`: **server-side wide event** fed to
 *   evlog. Pretty-printed in the dev terminal at the end of each request,
 *   shipped to drains (Axiom, Sentry, OTLP, ...) in production. Operator
 *   facing. Requires the optional `evlog` peer dependency to be installed
 *   and `mcp.logging` not explicitly disabled.
 */
export interface McpLogger {
  /**
   * Send a `notifications/message` to the connected MCP client.
   * Use `log.notify.info(...)` (and friends) for the common levels.
   */
  notify: McpClientNotifier

  /**
   * Accumulate context onto the current request's evlog wide event.
   *
   * @throws when observability is not active on this request — install
   * the optional `evlog` peer dependency and make sure `mcp.logging` is
   * not set to `false`.
   */
  set: (fields: Record<string, unknown>) => void
  /**
   * Append a discrete entry to the wide event's `requestLogs` and merge
   * any extra fields. Equivalent to `evlog.info(name, fields)`.
   *
   * @throws when observability is not active on this request — see `set`.
   */
  event: (name: string, fields?: Record<string, unknown>) => void
  /**
   * Underlying evlog request logger for advanced use (`fork`, `error`, …).
   *
   * @throws when observability is not active on this request — see `set`.
   */
  evlog: McpRequestLogger
}

const OBSERVABILITY_HINT
  = 'Server-side observability is not active on this request. '
    + 'Install the optional `evlog` peer dependency (`pnpm add evlog`) '
    + 'and make sure `mcp.logging` is not set to `false` in nuxt.config. '
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
 * Composable returning a split-channel logger bound to the current request.
 *
 * Must be called inside an MCP tool, resource, or prompt handler. Requires
 * `nitro.experimental.asyncContext: true`.
 *
 * The optional `prefix` becomes the default `logger` field on every
 * `notifications/message` so the client can group related log lines.
 *
 * @example
 * ```ts
 * const log = useMcpLogger('billing')
 *
 * // → MCP client (Inspector, Cursor, …) — always works
 * await log.notify.info({ msg: 'starting charge', amount: 1000 })
 *
 * // → server terminal / evlog drains — requires `evlog` installed
 * log.set({ user: { id: ctx.userId } })
 * log.event('charge_started', { amount: 1000 })
 * ```
 */
export function useMcpLogger(prefix?: string): McpLogger {
  const helper = useMcpServer()
  const sdkServer = getSdkServerFromHelper(helper)

  const event = safeEvent()
  const requestLogger = getEvlogLogger(event)

  // The SDK tracks `logging/setLevel` per session id, so we must forward the
  // current MCP session header to `sendLoggingMessage` for filtering to apply.
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
      // Disconnected client / unsubscribed level / no transport — never throw.
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
    set: (fields) => {
      requireRequestLogger().set(fields)
    },
    event: (name, fields) => {
      requireRequestLogger().info(name, fields)
    },
    get evlog() {
      return requireRequestLogger()
    },
  }
}

export { McpObservabilityNotEnabledError }
