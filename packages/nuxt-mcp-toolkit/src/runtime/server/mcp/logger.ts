import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js'
import type { RequestLogger } from 'evlog'
import { useEvent } from 'nitropack/runtime'
import { useLogger as useEvlogLogger } from 'evlog/nitro'
import { getHeader } from './compat'
import { useMcpServer } from './server'

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
 * Split-channel logger for MCP servers.
 *
 * Two clearly separated channels:
 *
 * - `log.notify(...)` (and `.notify.info`, `.notify.warning`, ...): **client
 *   notifications** sent over the MCP transport. Visible in the MCP
 *   Inspector "Server Notifications" panel and to AI clients. Honours the
 *   per-session `logging/setLevel`.
 * - `log.set(...)` / `log.event(...)`: **server-side wide event** fed to
 *   evlog. Pretty-printed in the dev terminal at the end of each request,
 *   shipped to drains (Axiom, Sentry, OTLP, ...) in production. Operator
 *   facing.
 *
 * Pick the channel based on the audience: end-users / AI client → `notify`,
 * operators / dashboards → `set` + `event`.
 */
export interface McpLogger {
  /**
   * Send a `notifications/message` to the connected MCP client.
   * Use `log.notify.info(...)` (and friends) for the common levels.
   */
  notify: McpClientNotifier

  /** Accumulate context onto the current request's evlog wide event. */
  set: (fields: Record<string, unknown>) => void
  /**
   * Append a discrete entry to the wide event's `requestLogs` and merge
   * any extra fields. Equivalent to `evlog.info(name, fields)`.
   */
  event: (name: string, fields?: Record<string, unknown>) => void
  /** Underlying evlog request logger for advanced use (`fork`, `error`, …). */
  evlog: RequestLogger
}

const noopEvlog: RequestLogger = {
  set: () => {},
  error: () => {},
  info: () => {},
  warn: () => {},
  emit: () => null,
  getContext: () => ({}),
}

function safeEvlog(): RequestLogger {
  try {
    const event = useEvent()
    return useEvlogLogger(event)
  }
  catch {
    return noopEvlog
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
 * // → MCP client (Inspector, Cursor, …)
 * await log.notify.info({ msg: 'starting charge', amount: 1000 })
 *
 * // → server terminal / evlog drains
 * log.set({ user: { id: ctx.userId } })
 * log.event('charge_started', { amount: 1000 })
 * ```
 */
export function useMcpLogger(prefix?: string): McpLogger {
  const helper = useMcpServer()
  // The high-level `McpServer` exposes the underlying SDK `Server` via `.server`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdkServer = (helper.server as any).server as {
    sendLoggingMessage: (params: { level: LoggingLevel, data: unknown, logger?: string }, sessionId?: string) => Promise<void>
  }

  const evlog = safeEvlog()
  // The SDK tracks `logging/setLevel` per session id, so we must forward the
  // current MCP session header to `sendLoggingMessage` for filtering to apply.
  let sessionId: string | undefined
  try {
    const event = useEvent()
    sessionId = getHeader(event, 'mcp-session-id') ?? undefined
  }
  catch {
    // Outside of a request scope (e.g., bootstrap) — sessionId stays undefined.
  }

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
      try {
        evlog.warn('mcp logger notify failed', {
          mcp: { logger: logger ?? prefix, level },
          error: err instanceof Error ? err.message : String(err),
        })
      }
      catch {
        // Evlog drain itself failed — stay silent to honor the no-throw contract.
      }
    }
  }

  // The notifier is a callable + level shortcuts so both styles read well.
  const notify = sendNotify as McpClientNotifier
  notify.debug = (data, logger) => sendNotify('debug', data, logger)
  notify.info = (data, logger) => sendNotify('info', data, logger)
  notify.warning = (data, logger) => sendNotify('warning', data, logger)
  notify.error = (data, logger) => sendNotify('error', data, logger)

  return {
    notify,
    set: (fields) => {
      evlog.set(fields)
    },
    event: (name, fields) => {
      evlog.info(name, fields)
    },
    evlog,
  }
}
