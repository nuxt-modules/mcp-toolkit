import { AsyncLocalStorage } from 'node:async_hooks'
import type { AuthInfo, ServerContext, ServerNotifier } from '@modelcontextprotocol/server'
import type { H3Event } from 'h3'

/**
 * What the toolkit attaches to `event.context.mcp` for the duration of a
 * tool, resource or prompt call.
 */
export interface McpEventContext {
  /** Authentication info for this request, when the caller supplied one. */
  auth?: AuthInfo
  /** Aborts when the client cancels the request. */
  signal: AbortSignal
  /**
   * The protocol revision serving this request: `modern` for 2026-07-28,
   * `legacy` for a 2025-era client answered through the SDK's fallback.
   */
  era: 'legacy' | 'modern'
  /**
   * The same object as `handler.notify` — push a list-changed or
   * resource-updated event without importing the handler this definition is
   * already registered on.
   */
  notify: ServerNotifier
  /**
   * The SDK's own per-request object — `id`, `method`, `signal`, and the
   * multi-round-trip primitives (`mcpReq.requestState`,
   * `mcpReq.inputResponses`), for everything the toolkit does not wrap under
   * a shorter name of its own.
   */
  mcpReq: ServerContext['mcpReq']
}

declare module 'h3' {
  interface H3EventContext {
    mcp?: McpEventContext
  }
}

/**
 * The event a tool, resource or prompt handler is called with: a plain
 * `H3Event` whose `context.mcp` is guaranteed present, rather than the
 * optional field every other event on the app carries.
 */
export type McpEvent = H3Event & { context: H3Event['context'] & { mcp: McpEventContext } }

interface RequestStore {
  event: H3Event
  era: 'legacy' | 'modern'
  notify: ServerNotifier
}

const storage = new AsyncLocalStorage<RequestStore>()

/**
 * @internal
 */
export function runWithRequest<T>(event: H3Event, notify: ServerNotifier, fn: () => T): T {
  return storage.run({ event, era: 'modern', notify }, fn)
}

/**
 * The era is only known once the SDK classifies the request and calls the
 * server factory, which happens inside the scope opened above.
 *
 * @internal
 */
export function setEra(era: 'legacy' | 'modern'): void {
  const store = storage.getStore()
  if (store) {
    store.era = era
  }
}

/**
 * Attach this call's `McpEventContext` to `event.context.mcp` and hand back
 * the same event — handlers read everything off it directly, rather than a
 * wrapper object.
 *
 * @internal
 */
export function attachContext(mcp: ServerContext): McpEvent {
  const store = storage.getStore()
  if (!store) {
    throw new Error(
      '[nitro-mcp-toolkit] No MCP request in scope. Handlers must be reached through the handler returned by `createMcpHandler`.',
    )
  }

  store.event.context.mcp = {
    auth: mcp.http?.authInfo,
    signal: mcp.mcpReq.signal,
    era: store.era,
    notify: store.notify,
    mcpReq: mcp.mcpReq,
  }

  // `context.mcp` was just set above, satisfying `McpEvent`'s guarantee — the
  // assertion encodes that invariant, not a gap the type checker missed.
  return store.event as McpEvent
}
