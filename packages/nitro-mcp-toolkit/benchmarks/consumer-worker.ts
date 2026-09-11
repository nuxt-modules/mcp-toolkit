import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Session } from 'node:inspector/promises'
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const started = performance.now()
const { default: app }: { default: { fetch: (request: Request) => Promise<Response> } } =
  await import(pathToFileURL(process.env.MCP_CONSUMER_ENTRY!).href)
const imported = performance.now()
const request = JSON.parse(process.env.MCP_CONSUMER_REQUEST!)
const first = await app.fetch(new Request('http://localhost/mcp', request))
assert.equal(first.status, 200)
const payload = await first.json()
assert(payload && typeof payload === 'object' && 'result' in payload)
const result = payload.result
assert(result && typeof result === 'object' && 'content' in result)
assert(!('isError' in result && result.isError))
assert.deepEqual(result.content, [{ type: 'text', text: '42' }])
const completed = performance.now()

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = []
    for await (const chunk of incoming) chunks.push(chunk)
    const headers = new Headers()
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(',') : value)
    }
    const response = await app.fetch(
      new Request('http://localhost/mcp', {
        method: 'POST',
        headers,
        body: Buffer.concat(chunks),
      }),
    )
    outgoing.writeHead(response.status, Object.fromEntries(response.headers))
    outgoing.end(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    outgoing.destroy(error instanceof Error ? error : new Error(String(error)))
  }
})
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
assert(address && typeof address === 'object')
process.send!({
  url: `http://127.0.0.1:${address.port}/mcp`,
  importMs: imported - started,
  firstRequestMs: completed - imported,
})

const session = new Session()
process.on('message', async (message) => {
  if (message === 'profile') {
    session.connect()
    await session.post('Profiler.enable')
    await session.post('Profiler.start')
    process.send!('profiling')
  } else if (message === 'stop') {
    const { profile } = await session.post('Profiler.stop')
    await writeFile(process.env.MCP_CONSUMER_PROFILE!, JSON.stringify(profile))
    session.disconnect()
    process.send!('saved')
  } else if (message === 'close') {
    server.closeAllConnections()
    server.close(() => process.disconnect!())
  }
})
