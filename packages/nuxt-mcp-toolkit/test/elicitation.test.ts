import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'

function createMcpUrl(path = '/mcp') {
  const baseUrl = url('/')
  const baseUrlObj = new URL(baseUrl)
  const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
  return new URL(path, origin)
}

type ElicitResponder = (params: { mode?: string, message: string, url?: string }) => {
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

interface ConnectedClient {
  client: Client
  responses: Array<unknown>
  setResponder: (fn: ElicitResponder) => void
}

async function createElicitClient(opts: {
  capabilities?: Record<string, unknown>
  initialResponder?: ElicitResponder
} = {}): Promise<ConnectedClient> {
  const responses: Array<unknown> = []
  let responder: ElicitResponder | null = opts.initialResponder ?? null

  const client = new Client(
    { name: 'elicit-test-client', version: '1.0.0' },
    { capabilities: opts.capabilities },
  )

  if (opts.capabilities?.elicitation) {
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      responses.push(request.params)
      if (!responder) {
        return { action: 'cancel' as const }
      }
      const out = responder(request.params as { mode?: string, message: string, url?: string })
      return out
    })
  }

  await client.connect(new StreamableHTTPClientTransport(createMcpUrl()))

  return {
    client,
    responses,
    setResponder(fn) {
      responder = fn
    },
  }
}

function readText(result: unknown): string {
  const content = (result as { content: Array<{ type: string, text?: string }> }).content
  const text = content.find(c => c.type === 'text')?.text
  if (!text) throw new Error('expected text content')
  return text
}

describe('useMcpElicitation', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/elicitation', import.meta.url)),
  })

  const opened: Client[] = []

  afterAll(async () => {
    for (const c of opened) {
      try {
        await c.close()
      }
      catch {
        // Ignore close errors — the test process is exiting anyway.
      }
    }
  })

  it('reports the modes declared by the connected client via supports()', async () => {
    // Empty `elicitation: {}` is normalized by the SDK to `{ form: {} }` for backwards compat.
    const a = await createElicitClient({ capabilities: { elicitation: {} } })
    opened.push(a.client)
    const result = await a.client.callTool({ name: 'supports_check', arguments: {} })
    expect(JSON.parse(readText(result))).toEqual({ form: true, url: false })

    // When other modes are declared, `form` must be opted in explicitly per MCP spec 2025-11-25.
    const b = await createElicitClient({ capabilities: { elicitation: { form: {}, url: {} } } })
    opened.push(b.client)
    const result2 = await b.client.callTool({ name: 'supports_check', arguments: {} })
    expect(JSON.parse(readText(result2))).toEqual({ form: true, url: true })

    const c = await createElicitClient({ capabilities: { elicitation: { url: {} } } })
    opened.push(c.client)
    const result3 = await c.client.callTool({ name: 'supports_check', arguments: {} })
    expect(JSON.parse(readText(result3))).toEqual({ form: false, url: true })

    const d = await createElicitClient({ capabilities: {} })
    opened.push(d.client)
    const result4 = await d.client.callTool({ name: 'supports_check', arguments: {} })
    expect(JSON.parse(readText(result4))).toEqual({ form: false, url: false })
  })

  it('form() validates the response against the requested Zod shape', async () => {
    const conn = await createElicitClient({
      capabilities: { elicitation: {} },
      initialResponder: () => ({
        action: 'accept',
        content: { name: 'Ada', channel: 'stable' },
      }),
    })
    opened.push(conn.client)

    const result = await conn.client.callTool({ name: 'ask_form', arguments: {} })
    const parsed = JSON.parse(readText(result))

    expect(parsed.action).toBe('accept')
    expect(parsed.content).toEqual({ name: 'Ada', channel: 'stable' })

    expect(conn.responses).toHaveLength(1)
    const params = conn.responses[0] as { mode?: string, requestedSchema: { properties: Record<string, unknown> } }
    expect(params.mode).toBe('form')
    expect(Object.keys(params.requestedSchema.properties).sort()).toEqual(['channel', 'name'])
  })

  it('form() returns the action without content when the user declines', async () => {
    const conn = await createElicitClient({
      capabilities: { elicitation: {} },
      initialResponder: () => ({ action: 'decline' }),
    })
    opened.push(conn.client)

    const result = await conn.client.callTool({ name: 'ask_form', arguments: {} })
    const parsed = JSON.parse(readText(result))

    expect(parsed).toEqual({ action: 'decline' })
  })

  it('form() throws McpElicitationError when the client did not declare elicitation', async () => {
    const conn = await createElicitClient({ capabilities: {} })
    opened.push(conn.client)

    const result = await conn.client.callTool({ name: 'ask_form', arguments: {} })
    const parsed = JSON.parse(readText(result))

    expect(parsed).toEqual({ error: 'unsupported' })
  })

  it('url() succeeds when the client declares elicitation.url', async () => {
    const conn = await createElicitClient({
      capabilities: { elicitation: { url: {} } },
      initialResponder: () => ({ action: 'accept' }),
    })
    opened.push(conn.client)

    const result = await conn.client.callTool({ name: 'ask_url', arguments: {} })
    const parsed = JSON.parse(readText(result))

    expect(parsed).toEqual({ action: 'accept' })

    const params = conn.responses[0] as { mode?: string, url?: string }
    expect(params.mode).toBe('url')
    expect(params.url).toBe('https://example.com/verify')
  })

  it('url() throws McpElicitationError when the client only declares form mode', async () => {
    const conn = await createElicitClient({
      capabilities: { elicitation: {} },
      initialResponder: () => ({ action: 'accept' }),
    })
    opened.push(conn.client)

    const result = await conn.client.callTool({ name: 'ask_url', arguments: {} })
    const parsed = JSON.parse(readText(result))

    expect(parsed).toEqual({ error: 'unsupported' })
  })

  it('confirm() returns true only when the user accepts with confirm=true', async () => {
    const accepting = await createElicitClient({
      capabilities: { elicitation: {} },
      initialResponder: () => ({ action: 'accept', content: { confirm: true } }),
    })
    opened.push(accepting.client)
    const acceptResult = await accepting.client.callTool({ name: 'ask_confirm', arguments: {} })
    expect(readText(acceptResult)).toBe('yes')

    const declining = await createElicitClient({
      capabilities: { elicitation: {} },
      initialResponder: () => ({ action: 'accept', content: { confirm: false } }),
    })
    opened.push(declining.client)
    const declineResult = await declining.client.callTool({ name: 'ask_confirm', arguments: {} })
    expect(readText(declineResult)).toBe('no')
  })
})
