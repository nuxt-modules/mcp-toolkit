/**
 * h3 v1 / v2 compatibility helpers.
 *
 * pnpm may resolve the module's `h3` peer dependency to v2 while
 * Nitro still bundles h3 v1 internally. This creates a version
 * mismatch: event objects are created by h3 v1 but the module's
 * code may be bundled against h3 v2. Key differences:
 *
 * - h3 v2 does NOT export `toWebRequest` (event.req IS a Request)
 * - h3 v1 `event.req.headers` is a plain object (no `.get()`)
 * - h3 v2 `event.req.headers` is a `Headers` instance
 *
 * Every cross-version cast is centralised here via {@link asCompat}
 * so the rest of the module stays free of `any`.
 */
import type { H3Event } from 'h3'
import {
  getMethod,
  getRequestHeaders,
  getRequestURL,
  getRequestWebStream,
} from 'h3'

/**
 * Internal shape covering the union of h3 v1 and v2 event surfaces we
 * need to read from. We never mutate the event through this type.
 */
interface H3CompatEvent {
  method?: string
  req?: Request | {
    method?: string
    headers?: Headers | Record<string, string | string[] | undefined>
    clone?: () => Request
  }
  web?: { request?: Request }
  node?: { req?: { method?: string }, res?: unknown }
}

const asCompat = (event: H3Event): H3CompatEvent => event as unknown as H3CompatEvent

export function getHeader(event: H3Event, name: string): string | undefined {
  const req = asCompat(event).req
  const headers = req && 'headers' in req ? req.headers : undefined
  if (headers && typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name) ?? undefined
  }
  const key = name.toLowerCase()
  const val = (headers as Record<string, string | string[] | undefined> | undefined)?.[key]
  return Array.isArray(val) ? val[0] : val
}

/**
 * Cross-version request method lookup. Always returns a string (uppercase
 * is not guaranteed — callers should normalise if comparing).
 */
export function getRequestMethod(event: H3Event): string {
  const e = asCompat(event)
  return e.method ?? e.node?.req?.method ?? 'GET'
}

/**
 * Convert an H3Event to a Web `Request`.
 *
 * Fast paths for both h3 versions, then a manual construction
 * fallback using h3 helpers that exist in both v1 and v2.
 */
export function toWebRequest(event: H3Event): Request {
  const e = asCompat(event)

  if (e.req instanceof Request) return e.req
  if (e.web?.request instanceof Request) return e.web.request
  // srvx Request may not pass instanceof across realms
  if (e.req && typeof (e.req as { clone?: () => Request }).clone === 'function') {
    return e.req as Request
  }

  // Construct manually — getRequestURL / getMethod / getRequestHeaders /
  // getRequestWebStream all exist in both h3 v1 (>=1.15) and v2.
  const url = getRequestURL(event)
  const method = getMethod(event)
  const rawHeaders = getRequestHeaders(event)
  const headers = new Headers()
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value !== undefined) headers.set(key, String(value))
  }
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody ? (getRequestWebStream(event) ?? null) : null
  return new Request(url.href, {
    method,
    headers,
    body,
    ...(body ? { duplex: 'half' } : {}),
  } as RequestInit)
}

/**
 * Best-effort access to the underlying Node `IncomingMessage` for
 * lifecycle events (`close`, `aborted`). Returns `null` on Web-only
 * runtimes (Cloudflare Workers, Vercel Edge, ...).
 */
export function getNodeResponse(event: H3Event): { on?: (event: 'close', cb: () => void) => unknown, once?: (event: 'close', cb: () => void) => unknown } | null {
  const node = asCompat(event).node
  return (node?.res as { on?: (event: 'close', cb: () => void) => unknown } | undefined) ?? null
}
