import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODERN_PROTOCOL_VERSION } from '../runtime/protocol.ts'
import type { ClientCapabilities } from '@modelcontextprotocol/client'
import type { McpHandler } from '../runtime/handler.ts'
import type { CallToolResult, GetPromptResult, ReadResourceResult } from '../runtime/index.ts'

/**
 * Anything fetch-shaped: the handler from `createMcpHandler`, or a built
 * Nitro app's entry.
 */
export type McpFetchHandler = Pick<McpHandler, 'fetch'>

/**
 * An SDK client that closes itself when it leaves scope.
 *
 * @example
 * ```ts
 * await using client = await createMcpTestClient(handler)
 * // no close needed, even if an assertion throws
 * ```
 */
export type McpTestClient = Client & AsyncDisposable

export interface McpTestClientOptions {
  /**
   * Which protocol revision the client negotiates. `modern` pins the latest
   * revision so a silent fallback cannot make the test pass against the wrong
   * era; `legacy` connects exactly like a 2025-era client.
   *
   * @default 'modern'
   */
  era?: 'modern' | 'legacy'
  /** Only the origin matters; the handler never sees the path. */
  url?: string
  capabilities?: ClientCapabilities
  /**
   * Extra headers on every request the client makes — a Bearer token, an
   * `X-MCP-Tools` allowlist, anything the handler reads off the request.
   */
  headers?: Record<string, string>
}

/**
 * Connect an MCP client to a handler in memory: no HTTP server, no port, no
 * build. The returned client is a real SDK `Client`, so every method behaves as
 * it would against a deployed server.
 *
 * @example
 * ```ts
 * await using client = await createMcpTestClient(handler)
 * const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })
 * ```
 */
export async function createMcpTestClient(
  handler: McpFetchHandler,
  options: McpTestClientOptions = {},
): Promise<McpTestClient> {
  const { era = 'modern', url = 'http://localhost/mcp', capabilities, headers } = options
  const extra = headers === undefined ? undefined : new Headers(headers)

  const client = new Client(
    { name: 'nitro-mcp-toolkit-test-client', version: '0.0.0' },
    {
      capabilities,
      versionNegotiation: {
        mode: era === 'modern' ? { pin: MODERN_PROTOCOL_VERSION } : 'legacy',
      },
    },
  )

  const transport = new StreamableHTTPClientTransport(new URL(url), {
    fetch: (input, init) => {
      const request = new Request(input, init)
      if (!extra) return handler.fetch(request)
      const merged = new Headers(request.headers)
      extra.forEach((value, key) => merged.set(key, value))
      return handler.fetch(new Request(request, { headers: merged }))
    },
  })

  await client.connect(transport)

  // `await using` then covers the close, which a failing assertion would
  // otherwise skip and leak.
  return Object.assign(client, {
    [Symbol.asyncDispose]: () => client.close(),
  })
}

type TextCarrier = Partial<CallToolResult & ReadResourceResult & GetPromptResult>

/**
 * The text a result carries, joined by newlines.
 *
 * Works on a tool call, a resource read and a prompt render alike, so an
 * assertion can read `expect(textOf(result)).toBe('Hello Ada')` instead of
 * spelling out the content-block shape.
 */
export function textOf(result: TextCarrier): string {
  const blocks = [
    ...(result.content ?? []),
    ...(result.contents ?? []),
    ...(result.messages ?? []).map((message) => message.content),
  ]

  return blocks
    .map((block) => ('text' in block && typeof block.text === 'string' ? block.text : ''))
    .filter((text) => text !== '')
    .join('\n')
}
