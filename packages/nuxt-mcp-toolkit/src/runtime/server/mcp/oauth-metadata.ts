import { defineEventHandler, setResponseStatus, setResponseHeader } from 'h3'

/**
 * Catch-all handler for OAuth discovery endpoints (RFC 9728 / RFC 8414).
 *
 * MCP clients (Inspector, Cursor, Claude, ChatGPT) probe these well-known
 * URIs at connection time to decide whether they need to run an OAuth
 * dance before talking to `/mcp`. We don't support OAuth in the toolkit
 * (yet), so the correct semantic answer is "no metadata here" — i.e. a
 * 404.
 *
 * The catch is that Nuxt's pages router would otherwise serve an HTML
 * error page for any unmatched route, and OAuth-aware clients try to
 * parse the body as JSON per RFC 6749 §5.2. Parsing `<!DOCTYPE html>` as
 * JSON throws `SyntaxError: Unexpected token '<'`, which Inspector
 * surfaces as a misleading "Invalid OAuth error response" connection
 * failure.
 *
 * Returning an empty JSON body with a 404 status keeps the discovery
 * fallback path clean while making it obvious to anyone hitting these
 * URIs in a browser that nothing is configured.
 */
export default defineEventHandler((event) => {
  setResponseStatus(event, 404)
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { error: 'not_found', error_description: 'OAuth is not configured for this MCP server.' }
})
