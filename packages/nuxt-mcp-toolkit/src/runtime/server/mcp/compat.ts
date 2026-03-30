/**
 * h3 v1 / v2 compatibility helpers.
 *
 * h3 v2's `getHeader()` calls `event.req.headers.get(name)`.
 * On some Nitro presets (e.g. Vercel Node) `event.req.headers` can be
 * a plain `Record<string, string | string[]>` without `.get()`.
 * These helpers handle both shapes transparently.
 */
import type { H3Event } from 'h3'

export function getHeader(event: H3Event, name: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const headers = (event as any).req?.headers
  if (typeof headers?.get === 'function') {
    return (headers as Headers).get(name) ?? undefined
  }
  const key = name.toLowerCase()
  const val = (headers as Record<string, string | string[] | undefined>)?.[key]
  return Array.isArray(val) ? val[0] : val
}

/**
 * Convert an H3Event to a Web `Request`.
 *
 * h3 v2: `event.req` extends `Request` via srvx prototype chain.
 * h3 v1: use `toWebRequest()` from h3 or `event.web.request`.
 */
export async function toWebRequest(event: H3Event): Promise<Request> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = event as any
  if (e.req instanceof Request) return e.req
  if (e.web?.request) return e.web.request
  const h3 = await import('h3') as Record<string, unknown>
  if (typeof h3.toWebRequest === 'function') {
    return (h3.toWebRequest as (ev: H3Event) => Request)(event)
  }
  throw new TypeError(
    '[@nuxtjs/mcp-toolkit] Cannot convert H3Event to Web Request.',
  )
}
