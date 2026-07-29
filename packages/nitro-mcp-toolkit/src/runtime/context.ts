import { AsyncLocalStorage } from 'node:async_hooks'
import type { AuthInfo, ServerContext } from '@modelcontextprotocol/server'
import type { H3Event } from 'h3'

/**
 * Context handed to every tool, resource and prompt handler.
 */
export interface McpContext {
  /**
   * The H3 event serving this request, giving handlers the whole Nitro
   * surface: `event.context` as populated by middleware, cookies, `waitUntil`.
   */
  event: H3Event
  /**
   * Authentication info for this request, when the caller supplied one.
   */
  auth?: AuthInfo
  /**
   * Aborts when the client cancels the request.
   */
  signal: AbortSignal
  /**
   * The protocol revision serving this request: `modern` for 2026-07-28,
   * `legacy` for a 2025-era client answered through the SDK's fallback.
   */
  era: 'legacy' | 'modern'
  /**
   * The raw SDK context, for everything the toolkit does not wrap — including
   * the multi-round-trip primitives (`mcp.mcpReq.requestState`,
   * `mcp.mcpReq.inputResponses`).
   */
  mcp: ServerContext
}

interface RequestStore {
  event: H3Event
  era: 'legacy' | 'modern'
}

const storage = new AsyncLocalStorage<RequestStore>()

/**
 * @internal
 */
export function runWithRequest<T>(event: H3Event, fn: () => T): T {
  return storage.run({ event, era: 'modern' }, fn)
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
 * @internal
 */
export function buildContext(mcp: ServerContext): McpContext {
  const store = storage.getStore()
  if (!store) {
    throw new Error(
      '[nitro-mcp-toolkit] No MCP request in scope. Handlers must be reached through the handler returned by `createMcpHandler`.',
    )
  }

  return {
    event: store.event,
    era: store.era,
    auth: mcp.http?.authInfo,
    signal: mcp.mcpReq.signal,
    mcp,
  }
}
