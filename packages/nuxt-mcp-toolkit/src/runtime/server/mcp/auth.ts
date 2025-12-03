import type { H3Event } from 'h3'
// @ts-expect-error - useEvent is auto-imported by Nitro at runtime
import { useEvent } from '#imports'

/**
 * Get the current H3 event in MCP handlers.
 *
 * Requires `nitro.experimental.asyncContext: true` in nuxt.config.ts
 *
 * @example
 * ```ts
 * export default defineMcpTool({
 *   handler: async () => {
 *     const event = useMcpEvent()
 *     const headers = event.headers
 *     // ...
 *   }
 * })
 * ```
 */
export function useMcpEvent(): H3Event {
  return useEvent()
}

/**
 * Get the MCP context from the current event.
 * This context is populated by the MCP middleware.
 *
 * Requires `nitro.experimental.asyncContext: true` in nuxt.config.ts
 *
 * @example
 * ```ts
 * // In middleware (server/mcp/middleware.ts):
 * event.context.mcp = { session, user }
 *
 * // In tool handler:
 * const ctx = getMcpContext<{ session: Session, user: User }>()
 * if (ctx?.user) {
 *   // User is authenticated
 * }
 * ```
 */
export function getMcpContext<T = unknown>(): T | undefined {
  try {
    const event = useEvent()
    return event.context.mcp as T | undefined
  }
  catch {
    return undefined
  }
}

/**
 * Require MCP context to be present (set by middleware).
 * Throws an error if context is not available.
 *
 * @example
 * ```ts
 * const { session, user } = requireMcpContext<{ session: Session, user: User }>()
 * // session and user are guaranteed to be present
 * ```
 */
export function requireMcpContext<T = unknown>(): T {
  const ctx = getMcpContext<T>()
  if (ctx === undefined) {
    throw new Error('MCP context not available. Ensure middleware is configured and sets event.context.mcp')
  }
  return ctx
}
