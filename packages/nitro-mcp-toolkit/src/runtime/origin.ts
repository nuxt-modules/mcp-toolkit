import type { H3Event } from 'h3'

export type McpOriginOptions = false | { allow?: string[]; allowMissing?: boolean }

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

// The loopback test is not optional: `event.url` reads the `Host` header, which
// DNS rebinding sets to the attacker's own name — matching its `Origin`.
function sameLoopbackOrigin(origin: string, event: H3Event): boolean {
  return origin === event.url.origin && LOOPBACK_HOSTS.has(event.url.hostname)
}

/**
 * Whether a browser is allowed to drive this endpoint. Requests carrying no
 * `Origin` — every MCP client proper — are unaffected by anything here.
 *
 * @internal
 */
export function isOriginAllowed(event: H3Event, origin: McpOriginOptions | undefined): boolean {
  if (origin === false) return true

  const header = event.req.headers.get('origin')
  if (!header) return origin?.allowMissing ?? true

  return origin?.allow?.includes(header) || sameLoopbackOrigin(header, event)
}

/** @internal */
export function forbiddenOriginResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32_600, message: 'Origin not allowed' },
    }),
    { status: 403, headers: { 'content-type': 'application/json' } },
  )
}
