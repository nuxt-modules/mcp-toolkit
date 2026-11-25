import type { H3Event } from 'h3/generic'
import type { ClientCapabilities, Implementation } from 'h3-mcp'

/**
 * Push list-changed and resource-updated events to every client currently
 * listening on this endpoint.
 */
export interface McpNotifier {
  toolsChanged: () => void
  promptsChanged: () => void
  resourcesChanged: () => void
  resourceUpdated: (uri: string) => void
}

/** Minimum severity a client asked to receive, per RFC 5424. */
export type McpLogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency'

/** What a definition handler can read about the MCP request it serves. */
export interface McpRequestContext {
  /** Legacy protocol session, when sessions are enabled. */
  sessionId?: string
  requestId?: string | number
  /** Aborted when the client cancels the request or its stream closes. */
  signal?: AbortSignal
  protocolVersion?: string
  /** The request's raw `params._meta`. Untrusted input. */
  meta?: Record<string, unknown>
  era?: 'modern' | 'legacy'
  clientCapabilities?: ClientCapabilities
  clientInfo?: Implementation
  logLevel?: McpLogLevel
  /** W3C trace-context values propagated through `_meta`. */
  trace?: { traceparent?: string; tracestate?: string; baggage?: string }
  /** Multi round-trip responses the client sent back on a retry. */
  inputResponses?: Record<string, unknown>
  /** Send a notification on this request's response stream, when it has one. */
  notify?: (method: string, params?: Record<string, unknown>) => void
  /** Report progress. A no-op when the request carried no progress token. */
  progress?: (progress: number, total?: number, message?: string) => void
  /** Send `notifications/message`. A no-op unless the client asked for this level. */
  log?: (level: McpLogLevel, data: unknown, logger?: string) => void
  /** Throw `-32021` when the client did not declare these capabilities. */
  requireClientCapability?: (...capabilities: string[]) => void
  /** Throw `-32021` when the client did not negotiate these extensions. */
  requireExtension?: (...extensionIds: string[]) => void
  notifier: McpNotifier
}

/**
 * The event a tool, resource or prompt handler is called with: a plain
 * `H3Event` whose `context.mcp` is guaranteed present, rather than the
 * optional field every other event on the app carries.
 */
export type McpEvent = H3Event & {
  context: H3Event['context'] & {
    mcp: McpRequestContext
    oauth?: import('./oauth.ts').McpOAuthClaims
  }
}

/**
 * Attach this endpoint's list-change notifier to `event.context.mcp.notifier` and
 * hand back the same event. h3-mcp has already populated the rest of the
 * context by the time a definition handler runs.
 *
 * @internal
 */
export function attachNotify(event: H3Event, notify: McpNotifier): McpEvent {
  const mcp = event.context.mcp
  if (!mcp) {
    throw new Error(
      '[nitro-mcp-toolkit] No MCP request in scope. Handlers must be reached through the handler returned by `createMcpHandler`.',
    )
  }

  Object.assign(mcp, { notifier: notify })
  return event as McpEvent
}
