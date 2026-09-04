import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { H3Event, toResponse } from 'h3'
import { defineMcpHandler, defineTool } from 'h3-mcp'
import { z } from 'zod'

const { createMcpHandler, defineMcpTool }: typeof import('../src/runtime/index.ts') = await import(
  process.argv[5]
)

const MODERN_PROTOCOL_VERSION = '2026-07-28'
const implementation = process.argv[2]
assert(implementation === 'bare' || implementation === 'toolkit')
const count = Number(process.argv[3])
const repeat = Number(process.argv[4])
const samples = Number(process.argv[6])
const warmups = 20
assert(Number.isInteger(samples) && samples > 0)
assert([10, 100, 1000].includes(count))
const inputSchema = z.object({ value: z.number() })
const definitions = Array.from({ length: count }, (_, i) => ({
  name: `tool-${i}`,
  inputSchema,
  handler: ({ value }: { value: number }) => ({
    content: [{ type: 'text' as const, text: String(value + 1) }],
  }),
}))
function createServerHandler() {
  if (implementation === 'toolkit') {
    return createMcpHandler({
      tools: definitions.map((definition) => defineMcpTool(definition)),
    }).fetch
  }
  const bare = defineMcpHandler({
    name: 'nitro-mcp-server',
    version: '0.0.0',
    tools: definitions.map((definition) => defineTool(definition)),
  })
  return async (request: Request) => {
    const event = new H3Event(request)
    return toResponse(await bare(event), event)
  }
}
const serve = createServerHandler()
const server = createServer(async (request, response) => {
  try {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const headers = new Headers()
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value)
    }
    const result = await serve(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers,
        body: Buffer.concat(chunks),
      }),
    )
    response.writeHead(result.status, Object.fromEntries(result.headers))
    response.end(Buffer.from(await result.arrayBuffer()))
  } catch (error) {
    response.destroy(error instanceof Error ? error : new Error(String(error)))
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address === 'object')
const url = `http://127.0.0.1:${address.port}/mcp`

try {
  for (const transport of ['memory', 'http']) {
    for (const workload of [
      'call',
      'catalog',
      ...(implementation === 'toolkit' ? ['subset'] : []),
    ]) {
      const run = async () => {
        let cursor: string | undefined
        let found = 0
        let pages = 0
        const cursors = new Set<string>()
        do {
          const method = workload === 'catalog' ? 'tools/list' : 'tools/call'
          const name = `tool-${count - 1}`
          const request = new Request(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
              'mcp-method': method,
              ...(workload === 'catalog' ? {} : { 'mcp-name': name }),
              ...(workload === 'subset' ? { 'x-mcp-tools': name } : {}),
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method,
              params: {
                ...(workload === 'catalog' ? { cursor } : { name, arguments: { value: 41 } }),
                _meta: {
                  'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
                  'io.modelcontextprotocol/clientCapabilities': {},
                },
              },
            }),
          })
          const response = await (transport === 'http' ? fetch(request) : serve(request))
          assert.equal(response.status, 200)
          const payload = await response.json()
          assert(
            payload && typeof payload === 'object' && 'result' in payload,
            JSON.stringify(payload),
          )
          const result = payload.result
          assert(result && typeof result === 'object')
          assert(!('isError' in result && result.isError), JSON.stringify(payload))
          pages++
          if (workload === 'catalog') {
            assert('tools' in result && Array.isArray(result.tools))
            found += result.tools.length
            const next = 'nextCursor' in result ? result.nextCursor : undefined
            assert(next === undefined || typeof next === 'string')
            if (next) {
              assert(!cursors.has(next), `Repeated cursor: ${next}`)
              cursors.add(next)
            }
            cursor = next
          } else {
            assert('content' in result && Array.isArray(result.content))
            assert.equal(result.content[0].text, '42')
          }
        } while (cursor)
        if (workload === 'catalog') assert.equal(found, count)
        return pages
      }
      for (let warmup = 0; warmup < warmups; warmup++) await run()
      const durations = []
      let pages = 0
      for (let sample = 0; sample < samples; sample++) {
        const start = performance.now()
        pages = await run()
        durations.push(performance.now() - start)
      }
      console.log(
        JSON.stringify({
          implementation,
          count,
          repeat,
          transport,
          workload,
          pages,
          durations,
        }),
      )
    }
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
