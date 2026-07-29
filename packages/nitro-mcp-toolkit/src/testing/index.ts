import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MODERN_PROTOCOL_VERSION } from '../runtime/protocol.ts'
import type { ClientCapabilities } from '@modelcontextprotocol/client'
import type { AuthInfo } from '@modelcontextprotocol/server'
import type { McpHandler } from '../runtime/handler.ts'

/**
 * Anything fetch-shaped: the handler from `createMcpHandler`, a bare SDK
 * handler, or a built Nitro app's entry.
 */
export type McpFetchHandler = Pick<McpHandler, 'fetch'>

export interface McpTestClientOptions {
  /**
   * Which protocol revision the client negotiates. `modern` pins the latest
   * revision so a silent fallback cannot make the test pass against the wrong
   * era; `legacy` connects exactly like a 2025-era client.
   *
   * @default 'modern'
   */
  era?: 'modern' | 'legacy'
  /**
   * Authentication info handed to the handler, standing in for the gate that
   * would verify a token in production.
   */
  auth?: AuthInfo
  /** Only the origin matters; the handler never sees the path. */
  url?: string
  capabilities?: ClientCapabilities
}

/**
 * Connect an MCP client to a handler in memory: no HTTP server, no port, no
 * build. The returned client is a real SDK `Client`, so every method behaves as
 * it would against a deployed server.
 *
 * @example
 * ```ts
 * const client = await createMcpTestClient(handler)
 * const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })
 * ```
 */
export async function createMcpTestClient(
  handler: McpFetchHandler,
  options: McpTestClientOptions = {},
): Promise<Client> {
  const { era = 'modern', auth, url = 'http://localhost/mcp', capabilities } = options

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
    fetch: (input, init) => handler.fetch(new Request(input, init), { authInfo: auth }),
  })

  await client.connect(transport)

  return client
}
