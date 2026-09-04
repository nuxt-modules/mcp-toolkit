import assert from 'node:assert/strict'
import { createMcpHandler, defineMcpTool, MODERN_PROTOCOL_VERSION } from 'nitro-mcp-toolkit'

for (const era of ['modern', 'legacy']) {
  for (const action of ['foreign-cancellation', 'request-abort']) {
    const entered = Promise.withResolvers<AbortSignal | undefined>()
    const finish = Promise.withResolvers<void>()
    const controller = new AbortController()
    const endpoint = createMcpHandler({
      auth: { tokens: ['alice', 'bob'] },
      tools: [
        defineMcpTool({
          name: 'slow',
          handler: async (event) => {
            entered.resolve(event.context.mcp?.signal)
            await finish.promise
            return 'done'
          },
        }),
      ],
    })
    const pending = endpoint.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: 'Bearer alice',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(era === 'modern'
            ? {
                'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
                'mcp-method': 'tools/call',
                'mcp-name': 'slow',
              }
            : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: {
            name: 'slow',
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
    const signal = await entered.promise
    try {
      if (action === 'request-abort') controller.abort()
      else
        await endpoint.fetch(
          new Request('http://localhost/mcp', {
            method: 'POST',
            headers: { authorization: 'Bearer bob', 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'notifications/cancelled',
              params: { requestId: 7 },
            }),
          }),
        )
      assert.equal(signal?.aborted, action === 'request-abort')
    } finally {
      finish.resolve()
      await pending
    }
  }
}
console.log(
  'Packed toolkit with patched engine: credential isolation and Fetch abort passed in both eras.',
)
