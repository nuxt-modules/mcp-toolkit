import { LoggingLevelSchema, SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { H3Event } from 'h3'
import { useEvent } from 'nitropack/runtime'
import { getSdkServer } from './internals'
import type { McpRequestExtra } from './definitions/sdk-extra'

/**
 * Sends a notification down the stream the client is already reading for the
 * request being handled. This is `sendNotification` from the SDK's
 * `RequestHandlerExtra`.
 */
export type McpRequestNotifier = McpRequestExtra['sendNotification']

const notifiers = new WeakMap<H3Event, McpRequestNotifier>()
const floors = new WeakMap<McpServer, LoggingLevel>()

const SEVERITY = new Map(LoggingLevelSchema.options.map((level, index) => [level, index]))

function severityOf(level: LoggingLevel): number {
  return SEVERITY.get(level) ?? 0
}

function currentEvent(): H3Event | null {
  try {
    return useEvent()
  }
  catch {
    return null
  }
}

/**
 * The SDK hands each definition handler a notifier bound to the request; it is
 * the only channel that reaches a client which has not opened the standalone
 * SSE stream. Duck-typed because `extra` arrives as the callback's last
 * argument, whose position depends on the shape the definition declared.
 */
function notifierOf(value: unknown): McpRequestNotifier | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = (value as { sendNotification?: unknown }).sendNotification
  return typeof candidate === 'function' ? candidate as McpRequestNotifier : undefined
}

/**
 * Remember the notifier for the request being handled, so `useMcpLogger` can
 * answer on its stream. Called with a definition callback's own arguments.
 *
 * @internal
 */
export function rememberRequestNotifier(args: readonly unknown[]): void {
  const notifier = notifierOf(args.at(-1))
  const event = currentEvent()
  if (notifier && event) {
    notifiers.set(event, notifier)
  }
}

/** @internal */
export function getRequestNotifier(event: H3Event | null | undefined): McpRequestNotifier | undefined {
  return event ? notifiers.get(event) : undefined
}

/**
 * Track `logging/setLevel` for this server. The SDK records it too, but keeps
 * it private and applies it only in `sendLoggingMessage` — the channel a
 * mid-request notification cannot use — so the filter has to be readable here.
 *
 * One level per server instance is enough: a server serves one session when
 * sessions are on, and one request when they are off.
 *
 * @internal
 */
export function trackLoggingLevel(server: McpServer): void {
  getSdkServer(server).setRequestHandler(SetLevelRequestSchema, async (request) => {
    const parsed = LoggingLevelSchema.safeParse(request.params.level)
    if (parsed.success) {
      floors.set(server, parsed.data)
    }
    return {}
  })
}

/**
 * Whether the client still wants messages of this level.
 *
 * @internal
 */
export function isLevelEnabled(server: McpServer, level: LoggingLevel): boolean {
  const floor = floors.get(server)
  return floor === undefined || severityOf(level) >= severityOf(floor)
}
