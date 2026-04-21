import type { H3Event } from 'h3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Server as SdkServer } from '@modelcontextprotocol/sdk/server/index.js'
import type { McpServerHelper } from './server'
import type { McpRequestLogger } from './logger'

/**
 * Reach the underlying low-level SDK server from the high-level
 * `McpServer` returned by the SDK. Both `McpServer` and the helper exposed
 * by `useMcpServer()` keep the original SDK `Server` on the `.server`
 * property — the high-level wrapper just doesn't expose it on the public type.
 *
 * One cast, one place — keeps the rest of the codebase free of `as any`.
 */
export function getSdkServer(server: McpServer): SdkServer {
  return (server as unknown as { server: SdkServer }).server
}

/**
 * Variant of {@link getSdkServer} that takes the helper returned by
 * `useMcpServer()`.
 */
export function getSdkServerFromHelper(helper: McpServerHelper): SdkServer {
  return getSdkServer(helper.server)
}

/**
 * Pull the per-request evlog logger off `event.context.log`.
 *
 * The toolkit does not depend on `evlog` at type level (it is an optional
 * peer dep), so we duck-type the candidate before returning it.
 *
 * Returns `null` when no event is bound, when evlog isn't installed, or
 * when its Nitro request plugin hasn't run for this request.
 */
export function getEvlogLogger(event: H3Event | null | undefined): McpRequestLogger | null {
  if (!event) return null
  const candidate = (event.context as { log?: Partial<McpRequestLogger> }).log
  if (
    candidate
    && typeof candidate.set === 'function'
    && typeof candidate.info === 'function'
  ) {
    return candidate as McpRequestLogger
  }
  return null
}
