import type { ZodRawShape } from 'zod'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import type { McpServer, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import type { McpToolCallback, McpToolCache } from './tools'
import { enrichNameTitle } from './utils'
import { createCacheOptions, wrapWithCache } from './cache'

/**
 * Content Security Policy configuration for MCP App UI
 * @see https://modelcontextprotocol.github.io/ext-apps/api/documents/Quickstart.html
 */
export interface McpAppCsp {
  /** Origins for network requests (fetch/XHR/WebSocket) - maps to CSP `connect-src` */
  connectDomains?: string[]
  /** Origins for static resources (scripts, images, styles) - maps to CSP `script-src`, `img-src`, etc. */
  resourceDomains?: string[]
  /** Origins for nested iframes - maps to CSP `frame-src` */
  frameDomains?: string[]
  /** Allowed base URIs - maps to CSP `base-uri` */
  baseUriDomains?: string[]
}

/**
 * UI configuration for MCP App
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
 */
export interface McpAppUi {
  /** HTML content for the app UI */
  html: string
  /** Content Security Policy configuration */
  csp?: McpAppCsp
  /** Sandbox permissions (camera, microphone, geolocation, clipboardWrite) */
  permissions?: {
    camera?: boolean
    microphone?: boolean
    geolocation?: boolean
    clipboardWrite?: boolean
  }
  /**
   * Tool visibility
   * - 'model': Tool visible to and callable by the AI agent
   * - 'app': Tool callable by the UI via postMessage
   * @default ['model', 'app']
   */
  visibility?: ('model' | 'app')[]
  /** Request visible border around the UI */
  prefersBorder?: boolean
}

/**
 * MCP App definition structure
 *
 * An MCP App is a tool that returns an interactive UI rendered in MCP hosts
 * like Claude Desktop, VS Code, or other MCP-compatible clients.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/apps
 * @see https://github.com/modelcontextprotocol/ext-apps (SEP-1865)
 */
export interface McpAppDefinition<
  InputSchema extends ZodRawShape | undefined = ZodRawShape,
  OutputSchema extends ZodRawShape = ZodRawShape,
> {
  /** Unique identifier (auto-generated from filename if omitted) */
  name?: string
  /** Display title (auto-generated from filename if omitted) */
  title?: string
  /** Description of what the app does */
  description?: string
  /** Zod schema for input validation */
  inputSchema?: InputSchema
  /** Zod schema for structured output */
  outputSchema?: OutputSchema
  /** Tool annotations (priority, audience, hints) */
  annotations?: ToolAnnotations
  /** Custom metadata */
  _meta?: Record<string, unknown>
  /** UI configuration */
  ui: McpAppUi
  /** Handler function for the tool */
  handler: McpToolCallback<InputSchema>
  /** Cache configuration (duration string like '1h', number in ms, or full options) */
  cache?: McpToolCache<InputSchema extends ZodRawShape ? ShapeOutput<InputSchema> : undefined>
}

/**
 * Register an app from a McpAppDefinition
 * This registers both the tool and its associated UI resource
 * @internal
 */
export function registerAppFromDefinition(
  server: McpServer,
  app: McpAppDefinition,
) {
  const { name, title } = enrichNameTitle({
    name: app.name,
    title: app.title,
    _meta: app._meta,
    type: 'app',
  })

  const resourceUri = `ui://${name}`
  const htmlContent = app.ui.html

  // Register UI resource with the special MCP Apps MIME type
  server.registerResource(
    `${name}-ui`,
    resourceUri,
    {
      title: `${title} UI`,
      description: `Interactive UI for ${title}`,
      mimeType: RESOURCE_MIME_TYPE,
    },
    async (uri: URL) => ({
      contents: [{
        uri: uri.toString(),
        mimeType: RESOURCE_MIME_TYPE,
        text: htmlContent,
        _meta: {
          ui: {
            csp: app.ui.csp,
            permissions: app.ui.permissions,
            prefersBorder: app.ui.prefersBorder,
          },
        },
      }],
    }),
  )

  // Wrap handler with cache if defined
  let handler: ToolCallback<ZodRawShape> = app.handler as ToolCallback<ZodRawShape>

  if (app.cache !== undefined) {
    const defaultGetKey = app.inputSchema
      ? (args: unknown) => {
          const values = Object.values(args as Record<string, unknown>)
          return values.map(v => String(v).replace(/\//g, '-').replace(/^-/, '')).join(':')
        }
      : undefined

    handler = wrapWithCache(
      app.handler as (...args: unknown[]) => unknown,
      createCacheOptions(app.cache, `mcp-app:${name}`, defaultGetKey),
    ) as ToolCallback<ZodRawShape>
  }

  // Register tool with _meta.ui linking to the resource
  return server.registerTool(name, {
    title,
    description: app.description,
    inputSchema: app.inputSchema,
    outputSchema: app.outputSchema,
    annotations: app.annotations,
    _meta: {
      ...app._meta,
      ui: {
        resourceUri,
        visibility: app.ui.visibility || ['model', 'app'],
      },
    },
  }, handler)
}

/**
 * Define an MCP App with interactive UI.
 *
 * `name` and `title` are auto-generated from filename if not provided.
 *
 * @see https://mcp-toolkit.nuxt.dev/core-concepts/apps
 *
 * @example
 * ```ts
 * export default defineMcpApp({
 *   description: 'Display weather dashboard',
 *   inputSchema: { location: z.string() },
 *   ui: {
 *     html: `<!DOCTYPE html><html>...</html>`,
 *   },
 *   handler: async ({ location }) => textResult(`Weather: ${location}`)
 * })
 * ```
 */
export function defineMcpApp<
  const InputSchema extends ZodRawShape | undefined = ZodRawShape,
  const OutputSchema extends ZodRawShape = ZodRawShape,
>(
  definition: McpAppDefinition<InputSchema, OutputSchema>,
): McpAppDefinition<InputSchema, OutputSchema> {
  return definition
}
