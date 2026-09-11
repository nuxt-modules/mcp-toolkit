import { z } from 'zod'
import {
  createMcpHandler,
  createMcpOAuth,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
  MODERN_PROTOCOL_VERSION,
} from 'nitro-mcp-toolkit'

function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`)
  }
}

export async function checkRuntime(): Promise<void> {
  const oauth = createMcpOAuth({
    resource: 'https://app.example/mcp',
    authorizationServers: ['https://auth.example'],
    verify: async (token, event) => {
      if (token !== 'reader') return false
      event.context.oauth = { sub: token, scope: 'account:read' }
      return true
    },
  })
  const endpoint = createMcpHandler({
    auth: oauth.auth,
    tools: [
      defineMcpTool({
        name: 'account',
        scopes: ['account:read'],
        inputSchema: z.object({ suffix: z.string() }),
        outputSchema: z.object({ content: z.string() }),
        handler: ({ suffix }, event) => ({ content: `${event.context.oauth?.sub}:${suffix}` }),
      }),
      defineMcpTool({
        name: 'failure',
        handler: () => {
          throw new Error('public failure')
        },
      }),
    ],
    resources: [
      defineMcpResource({
        name: 'document',
        uriTemplate: 'docs://{slug}',
        handler: (_uri, { slug }) => slug,
      }),
    ],
    prompts: [defineMcpPrompt({ name: 'review', handler: () => 'review this' })],
  })

  for (const era of ['modern', 'legacy']) {
    const call = async (
      method: string,
      params: Record<string, unknown> = {},
      headers: Record<string, string> = {},
    ) => {
      const response = await endpoint.fetch(
        new Request('http://localhost/mcp', {
          method: 'POST',
          headers: {
            authorization: 'Bearer reader',
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            ...(era === 'modern'
              ? {
                  'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
                  'mcp-method': method,
                  ...((params.name ?? params.uri)
                    ? { 'mcp-name': String(params.name ?? params.uri) }
                    : {}),
                }
              : {}),
            ...headers,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params: {
              ...params,
              ...(era === 'modern'
                ? {
                    _meta: {
                      'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
                      'io.modelcontextprotocol/clientCapabilities': {},
                    },
                  }
                : {}),
            },
          }),
        }),
      )
      const text = await response.text()
      const data = response.headers.get('content-type')?.includes('text/event-stream')
        ? text
            .split('\n')
            .find((line) => line.startsWith('data:'))
            ?.slice(5)
        : text
      if (!data) throw new Error(`Missing ${era} response for ${method}`)
      return { status: response.status, payload: JSON.parse(data), headers: response.headers }
    }
    const account = await call('tools/call', { name: 'account', arguments: { suffix: 'ok' } })
    if (account.payload.error) throw new Error(`${era}: ${JSON.stringify(account.payload.error)}`)
    equal(account.status, 200)
    equal(account.payload.result.structuredContent, { content: 'reader:ok' })
    const listing = await call('tools/list', {}, { 'x-mcp-tools': 'account' })
    equal(
      listing.payload.result.tools.map((tool: { name: string }) => tool.name),
      ['account'],
    )
    const denied = await call('tools/call', { name: 'failure' }, { 'x-mcp-tools': 'account' })
    if (!denied.payload.error) throw new Error('A filtered tool was callable')
    const unknown = await call('tools/list', {}, { 'x-mcp-tools': 'missing' })
    equal(unknown.status, 400)
    const unauthorized = await call('tools/list', {}, { authorization: 'Bearer invalid' })
    equal(unauthorized.status, 401)
    if (!unauthorized.headers.get('www-authenticate')?.includes('resource_metadata=')) {
      throw new Error('Missing resource metadata challenge')
    }
    equal((await call('tools/list', {}, { origin: 'https://foreign.example' })).status, 403)
    const failure = await call('tools/call', { name: 'failure' })
    equal(failure.payload.result.isError, true)
    const resource = await call('resources/read', { uri: 'docs://intro' })
    equal(resource.payload.result.contents[0].text, 'intro')
    const prompt = await call('prompts/get', { name: 'review' })
    equal(prompt.payload.result.messages[0].content.text, 'review this')
  }
}

if (import.meta.main) {
  await checkRuntime()
  console.log(
    'Runtime checks passed: both eras, schemas, resources, prompts, OAuth, origin and tool selection.',
  )
}
