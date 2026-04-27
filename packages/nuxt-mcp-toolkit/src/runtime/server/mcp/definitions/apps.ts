import type { ZodRawShape } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { McpRequestExtra } from './sdk-extra'
import type { McpToolDefinition, McpToolCallback, McpToolAnnotations } from './tools'
import type { StandardMcpResourceDefinition } from './resources'
import { normalizeToolResult, type McpToolCallbackResult } from './results'

/** MIME advertised for MCP App resources (SEP-1865, ext-apps draft `2026-01-26`). */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app'

/**
 * Brand symbol that marks objects produced by {@link defineMcpApp}.
 * @internal
 */
export const MCP_APP_BRAND: unique symbol = Symbol.for('nuxt-mcp-toolkit:mcp-app')

const MAX_INJECTED_DATA_BYTES = 1024 * 1024
const SAFE_APP_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/
const DATA_SCRIPT_ID = '__mcp_app_data__'

/** @internal */
export function assertSafeAppName(name: string): void {
  if (typeof name !== 'string' || !SAFE_APP_NAME.test(name)) {
    throw new TypeError(
      `Invalid MCP App name: ${JSON.stringify(name)}. Expected kebab-case matching ${SAFE_APP_NAME}.`,
    )
  }
}

/** @internal */
export function buildAppResourceUri(name: string): string {
  assertSafeAppName(name)
  return `ui://mcp-app/${name}`
}

function escapeJsonForHtml(value: string): string {
  return value
    .replace(/\u003C/g, '\\u003c')
    .replace(/\u003E/g, '\\u003e')
    .replace(/\u0026/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function injectAppData(html: string, data: unknown): string {
  const json = escapeJsonForHtml(JSON.stringify(data ?? {}))
  if (Buffer.byteLength(json, 'utf-8') > MAX_INJECTED_DATA_BYTES) {
    throw new RangeError(
      `MCP App initial data exceeds ${MAX_INJECTED_DATA_BYTES} bytes — return a leaner structuredContent or fetch the data lazily.`,
    )
  }
  const tag = `<script id="${DATA_SCRIPT_ID}" type="application/json">${json}</script>`
  if (html.includes('</body>')) return html.replace('</body>', `${tag}</body>`)
  return `${html}\n${tag}`
}

/** Per-app Content Security Policy. Set `false` to opt out (not recommended). */
export interface McpAppCsp {
  /** Origins the iframe may load scripts/styles/images/fonts from. */
  resourceDomains?: string[]
  /** Origins the iframe may reach via fetch/XHR/WebSockets. Empty list blocks all outbound network. */
  connectDomains?: string[]
}

function assertSafeCspDomain(domain: string): void {
  if (typeof domain !== 'string' || !domain.length) {
    throw new TypeError(`CSP domain must be a non-empty string, got ${JSON.stringify(domain)}.`)
  }
  if (/[\s;]/.test(domain) || domain.includes('\'') || domain.includes('"')) {
    throw new TypeError(`CSP domain contains forbidden characters: ${JSON.stringify(domain)}.`)
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(domain) && !/^(?:https?|wss?):/i.test(domain)) {
    throw new TypeError(`CSP domain must use http(s):// or ws(s)://, got ${JSON.stringify(domain)}.`)
  }
}

function renderCspMeta(csp: McpAppCsp): string {
  const res = (csp.resourceDomains ?? []).map((d) => {
    assertSafeCspDomain(d)
    return d
  })
  const con = (csp.connectDomains ?? []).map((d) => {
    assertSafeCspDomain(d)
    return d
  })
  const join = (items: string[]) => items.length ? ` ${items.join(' ')}` : ''
  const directives = [
    `default-src 'none'`,
    `script-src 'unsafe-inline' data: blob:${join(res)}`,
    `style-src 'unsafe-inline'${join(res)}`,
    `img-src data: blob:${join(res)}`,
    `font-src data:${join(res)}`,
    `connect-src${con.length ? join(con) : ` 'none'`}`,
    `form-action 'none'`,
    `base-uri 'none'`,
    `object-src 'none'`,
  ].join('; ')
  return `<meta http-equiv="Content-Security-Policy" content="${directives}">`
}

function injectCspMeta(html: string, csp: McpAppCsp | false | undefined): string {
  if (csp === false) return html
  const meta = renderCspMeta(csp ?? {})
  if (html.includes('<head>')) return html.replace('<head>', `<head>\n    ${meta}`)
  return `${meta}\n${html}`
}

function cspToMeta(csp: McpAppCsp | false | undefined): McpAppCsp | undefined {
  if (csp === false) return undefined
  return {
    resourceDomains: csp?.resourceDomains ?? [],
    connectDomains: csp?.connectDomains ?? [],
  }
}

function normalizeOrigin(value: string): string {
  return value.startsWith('http://') || value.startsWith('https://')
    ? value
    : `https://${value}`
}

function detectAppDomain(): string | undefined {
  const env = typeof process !== 'undefined' ? process.env : {}
  const value = env.NUXT_PUBLIC_APP_URL
    ?? env.VERCEL_PROJECT_PRODUCTION_URL
    ?? env.VERCEL_URL
    ?? env.URL
    ?? env.RENDER_EXTERNAL_URL
    ?? env.RAILWAY_PUBLIC_DOMAIN
    ?? env.FLY_APP_NAME

  if (!value) return undefined
  if (value === env.FLY_APP_NAME) return `https://${value}.fly.dev`
  return normalizeOrigin(value)
}

/**
 * Build the `_meta` shared by tool definition, every tool-call result, and the
 * `ui://` resource. The `openai/*` keys are a compat layer for ChatGPT.
 * @internal
 */
export function buildAppMeta(
  app: McpAppDefinition,
  resourceUri: string,
): Record<string, unknown> {
  const userMeta = app._meta ?? {}
  const userUi = (userMeta.ui as Record<string, unknown> | undefined) ?? {}
  const cspMeta = cspToMeta(app.csp)
  const domain = typeof userUi.domain === 'string' ? userUi.domain : detectAppDomain()

  return {
    'ui': {
      ...userUi,
      ...(domain ? { domain } : {}),
      resourceUri,
      ...(cspMeta ? { csp: cspMeta } : {}),
    },
    'openai/outputTemplate': resourceUri,
    'openai/widgetAccessible': true,
    ...(cspMeta
      ? {
          'openai/widgetCSP': {
            resource_domains: cspMeta.resourceDomains,
            connect_domains: cspMeta.connectDomains,
          },
        }
      : {}),
  }
}

/** Options accepted by {@link defineMcpApp}. */
export interface McpAppOptions<
  InputSchema extends ZodRawShape | undefined = ZodRawShape,
> {
  /** Tool name shown to clients. Auto-derived from the SFC filename when omitted. */
  name?: string
  /** Human-readable title displayed by hosts. */
  title?: string
  /** Description shown to the LLM to help it pick this app. */
  description?: string
  /** Zod schema describing the tool's input. */
  inputSchema?: InputSchema
  /** Server-side handler. Defaults to `(args) => ({ structuredContent: args })`. */
  handler?: McpToolCallback<InputSchema>
  /** Behavioral hints forwarded to the generated MCP tool descriptor. */
  annotations?: McpToolAnnotations
  /** CSP applied to the iframe HTML and mirrored into `_meta.ui.csp`. Pass `false` to disable. */
  csp?: McpAppCsp | false
  /** Free-form `_meta`. `ui.resourceUri` and `ui.csp` are auto-injected. */
  _meta?: Record<string, unknown>
}

/** Output of {@link defineMcpApp}: an opaque options bag the build-time loader pairs with the bundled HTML. */
export interface McpAppDefinition<
  InputSchema extends ZodRawShape | undefined = ZodRawShape,
> extends McpAppOptions<InputSchema> {
  readonly [MCP_APP_BRAND]: true
}

/**
 * Declare an MCP App from a Vue SFC. Used as a build-time macro inside
 * `<script setup>` (similar to `definePageMeta`): the toolkit extracts the
 * call at build time, generates a matching MCP tool + UI resource, and strips
 * the call from the browser bundle.
 */
export function defineMcpApp<
  const InputSchema extends ZodRawShape | undefined = ZodRawShape,
>(
  options: McpAppOptions<InputSchema> = {} as McpAppOptions<InputSchema>,
): McpAppDefinition<InputSchema> {
  return { ...options, [MCP_APP_BRAND]: true }
}

type AnyAppHandler = (
  args: Record<string, unknown>,
  extra: McpRequestExtra,
) => McpToolCallbackResult | Promise<McpToolCallbackResult>

function prepareAppHtml(html: string, app: McpAppDefinition, data?: unknown): string {
  const withCsp = injectCspMeta(html, app.csp)
  if (data === undefined) return withCsp
  return injectAppData(withCsp, data)
}

/**
 * Wrap a {@link McpAppDefinition} into the tool definition the existing pipeline registers.
 * @internal
 */
export function _createAppTool(
  app: McpAppDefinition,
  ctx: { name: string, html: string },
): McpToolDefinition {
  assertSafeAppName(ctx.name)
  const resourceUri = buildAppResourceUri(ctx.name)
  const userMeta = app._meta ?? {}
  const sharedMeta = buildAppMeta(app, resourceUri)

  const wrapped: McpToolCallback = async (args, extra) => {
    const handlerArgs = (args ?? {}) as Record<string, unknown>

    try {
      const userResult: McpToolCallbackResult = app.handler
        ? await (app.handler as AnyAppHandler)(handlerArgs, extra)
        : { structuredContent: handlerArgs }

      const normalised: CallToolResult = normalizeToolResult(userResult)
      const structuredContent = (normalised.structuredContent ?? handlerArgs) as Record<string, unknown>
      const html = prepareAppHtml(ctx.html, app, structuredContent)

      return {
        ...normalised,
        structuredContent,
        content: [
          {
            type: 'resource',
            resource: {
              uri: resourceUri,
              mimeType: MCP_APP_MIME_TYPE,
              text: html,
              _meta: sharedMeta,
            },
          },
          ...(normalised.content ?? []),
        ],
        _meta: { ...(normalised._meta ?? {}), ...sharedMeta },
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        isError: true,
        content: [{ type: 'text', text: `MCP App "${ctx.name}" handler failed: ${message}` }],
      }
    }
  }

  return {
    name: app.name ?? ctx.name,
    title: app.title,
    description: app.description,
    inputSchema: app.inputSchema,
    annotations: app.annotations,
    handler: wrapped,
    _meta: { ...userMeta, ...sharedMeta },
  }
}

/**
 * Build the standalone `ui://` resource serving the bundled HTML page.
 * @internal
 */
export function _createAppResource(
  app: McpAppDefinition,
  ctx: { name: string, html: string },
): StandardMcpResourceDefinition {
  assertSafeAppName(ctx.name)
  const resourceUri = buildAppResourceUri(ctx.name)
  const html = prepareAppHtml(ctx.html, app)
  const sharedMeta = buildAppMeta(app, resourceUri)

  return {
    name: `${ctx.name}-app`,
    title: app.title ?? app.name ?? ctx.name,
    description: app.description,
    uri: resourceUri,
    metadata: { mimeType: MCP_APP_MIME_TYPE },
    _meta: sharedMeta,
    handler: async (uri: URL) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: MCP_APP_MIME_TYPE,
        text: html,
        _meta: sharedMeta,
      }],
    }),
  }
}
