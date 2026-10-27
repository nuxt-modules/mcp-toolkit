import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { build, createNitro } from 'nitropack/core'
import type { Nitro } from 'nitropack/types'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import mcp from '../src/module/nitro2.ts'
import { MODERN_PROTOCOL_VERSION } from '../src/runtime/index.ts'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'

describe('a built Nitro 2 app', () => {
  let root: string
  let nitro: Nitro
  let http: Server | undefined
  let origin: string
  const handler = { fetch: (request: Request) => fetch(request) }
  const readSignals = async () =>
    z
      .object({ started: z.number(), aborted: z.number() })
      .parse(await fetch(`${origin}/signals`).then((result) => result.json()))

  beforeAll(async () => {
    root = normalize(await realpath(await mkdtemp(join(tmpdir(), 'mcp-nitro2-'))))
    const toolkit = normalize(fileURLToPath(new URL('../src/runtime/index.ts', import.meta.url)))
    const files = {
      'server/state.ts':
        'export const signals = { started: 0, aborted: 0 }; export const calls = []',
      'server/mcp/tools/who.ts': `
import { defineMcpTool } from ${JSON.stringify(toolkit)}
export default defineMcpTool({ handler: event => event.context.user })
`,
      'server/mcp/tools/slow.ts': `
import { defineMcpTool } from ${JSON.stringify(toolkit)}
import { signals } from '../../state.ts'
export default defineMcpTool({ handler: event => new Promise(resolve => {
  signals.started++
  event.context.mcp.progress(0, 1, 'started')
  event.context.mcp.signal.addEventListener('abort', () => {
    signals.aborted++
    resolve('cancelled')
  }, { once: true })
}) })
`,
      'server/mcp/resources/readme.ts': `
import { defineMcpResource } from ${JSON.stringify(toolkit)}
export default defineMcpResource({ uri: 'docs://readme', handler: () => 'Nitro 2 resource' })
`,
      'server/mcp/prompts/review.ts': `
import { defineMcpPrompt } from ${JSON.stringify(toolkit)}
export default defineMcpPrompt({ handler: () => 'Review this app.' })
`,
      'server/mcp/plugins.ts': `
import { defineMcpPlugins } from ${JSON.stringify(toolkit)}
export default defineMcpPlugins([{ id: 'fixture/nitro2', settings: () => ({ enabled: true }) }])
`,
      'server/mcp-admin/tools/purge.ts': `
import { defineMcpTool } from ${JSON.stringify(toolkit)}
export default defineMcpTool({ handler: () => 'purged' })
`,
      'middleware.ts': `
import { defineEventHandler, readBody, setResponseHeader } from 'h3'
export default defineEventHandler(async event => {
  event.context.user = 'demo-user'
  if (event.method === 'POST') await readBody(event)
  setResponseHeader(event, 'x-middleware', 'preserved')
})
`,
      'signals.ts': `
import { defineEventHandler } from 'h3'
import { signals } from './server/state.ts'
export default defineEventHandler(() => signals)
`,
      'catalog.ts': `
import { defineEventHandler } from 'h3'
import { mcp } from 'nitro-mcp-toolkit/servers'
export default defineEventHandler(() => mcp.definitions)
`,
      'notify.ts': `
import { defineEventHandler } from 'h3'
import { mcp } from 'nitro-mcp-toolkit/servers'
export default defineEventHandler(() => { mcp.notify.toolsChanged(); return 'notified' })
`,
      'calls.ts': `
import { defineEventHandler } from 'h3'
import { calls } from './server/state.ts'
export default defineEventHandler(() => calls)
`,
      'plugin.ts': `
import { defineNitroPlugin } from 'nitropack/runtime'
import { calls } from './server/state.ts'
export default defineNitroPlugin(app => {
  app.hooks.hook('mcp:tool:called', call => calls.push({ name: call.name, path: call.event.url.pathname }))
})
`,
    }
    for (const [file, contents] of Object.entries(files)) {
      const path = join(root, file)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, contents)
    }
    nitro = await createNitro({
      rootDir: root,
      srcDir: 'server',
      dev: false,
      preset: 'node-listener',
      nodeModulesDirs: [
        normalize(fileURLToPath(new URL('../../../node_modules', import.meta.url))),
      ],
      alias: { 'nitro-mcp-toolkit': toolkit },
      handlers: [
        { handler: join(root, 'middleware.ts'), middleware: true },
        ...['signals', 'catalog', 'notify', 'calls'].map((name) => ({
          route: `/${name}`,
          handler: join(root, `${name}.ts`),
        })),
      ],
      plugins: [join(root, 'plugin.ts')],
      modules: [
        mcp(),
        mcp({ route: '/admin/mcp', dir: 'server/mcp-admin', auth: { tokens: ['demo-token'] } }),
        mcp({
          route: '/oauth/mcp',
          oauth: {
            resource: 'http://localhost/oauth/mcp',
            authorizationServers: ['https://issuer.example.com'],
            jwt: { jwks: 'https://issuer.example.com/jwks' },
          },
        }),
      ],
    })
    await build(nitro)
    const entry: { listener: (request: IncomingMessage, response: ServerResponse) => void } =
      await import(`${nitro.options.output.serverDir}/index.mjs`)
    const server = createServer(entry.listener)
    http = server
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test server.')
    origin = `http://127.0.0.1:${address.port}`
  }, 60_000)

  afterAll(async () => {
    const server = http
    if (server) {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
    await nitro?.close()
    if (root) await rm(root, { recursive: true, force: true })
  })

  it.for(['modern', 'legacy'] as const)(
    'serves tools, resources, and prompts to %s clients',
    async (era) => {
      await using client = await createMcpTestClient(handler, { era, url: `${origin}/mcp` })
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['slow', 'who'])
      expect(textOf(await client.callTool({ name: 'who' }))).toBe('demo-user')
      expect(textOf(await client.readResource({ uri: 'docs://readme' }))).toBe('Nitro 2 resource')
      expect(textOf(await client.getPrompt({ name: 'review' }))).toBe('Review this app.')
      expect(client.getServerCapabilities()?.extensions).toEqual(
        era === 'modern' ? { 'fixture/nitro2': { enabled: true } } : undefined,
      )
    },
  )

  it.for(['2025-03-26', '2025-06-18', '2025-11-25'])(
    'negotiates protocol revision %s',
    async (protocolVersion) => {
      const response = await fetch(`${origin}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion,
            capabilities: {},
            clientInfo: { name: 'legacy-fixture', version: '1.0.0' },
          },
        }),
      })
      expect(response.status).toBe(200)
      const result = z
        .object({ result: z.object({ protocolVersion: z.string() }) })
        .parse(await response.json())
      expect(result.result.protocolVersion).toBe(protocolVersion)
    },
  )

  it('keeps the protected endpoint on its own definitions', async () => {
    await expect(createMcpTestClient(handler, { url: `${origin}/admin/mcp` })).rejects.toThrow(
      /401/,
    )
    await using client = await createMcpTestClient(handler, {
      url: `${origin}/admin/mcp`,
      headers: { authorization: 'Bearer demo-token' },
    })
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['purge'])
    expect(textOf(await client.callTool({ name: 'purge' }))).toBe('purged')
  })

  it('preserves middleware headers and client tool selection', async () => {
    const response = await fetch(`${origin}/mcp`)
    expect(response.headers.get('x-middleware')).toBe('preserved')
    await response.body?.cancel()
    await using client = await createMcpTestClient(handler, {
      url: `${origin}/mcp`,
      headers: { 'x-mcp-tools': 'who' },
    })
    expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(['who'])
    const catalog = z
      .array(z.object({ kind: z.string(), name: z.string() }))
      .parse(await fetch(`${origin}/catalog`).then((result) => result.json()))
    expect(
      catalog
        .filter((definition) => definition.kind === 'tool')
        .map((definition) => definition.name),
    ).toEqual(['slow', 'who'])
  })

  it('mounts OAuth discovery through the Nitro 2 adapter', async () => {
    const response = await fetch(`${origin}/.well-known/oauth-protected-resource/oauth/mcp`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      resource: 'http://localhost/oauth/mcp',
      authorization_servers: ['https://issuer.example.com'],
    })
  })

  it('relays tool-call hooks to the Nitro 2 app', async () => {
    await using client = await createMcpTestClient(handler, { url: `${origin}/mcp` })
    await client.callTool({ name: 'who' })
    const calls = z
      .array(z.object({ name: z.string(), path: z.string() }))
      .parse(await fetch(`${origin}/calls`).then((result) => result.json()))
    expect(calls.at(-1)).toMatchObject({ name: 'who', path: '/mcp' })
  })

  it('delivers catalog notifications over a persistent stream', async () => {
    await using client = await createMcpTestClient(handler, { url: `${origin}/mcp` })
    const changed = vi.fn()
    client.setNotificationHandler('notifications/tools/list_changed', changed)
    const subscription = await client.listen({ toolsListChanged: true })
    await fetch(`${origin}/notify`)
    await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce())
    await subscription.close()
  })

  it.for(['modern', 'legacy'] as const)(
    'cancels a %s invocation when its HTTP stream disconnects',
    async (era) => {
      const before = await readSignals()
      const controller = new AbortController()
      const meta =
        era === 'modern'
          ? {
              'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
              'io.modelcontextprotocol/clientCapabilities': {},
            }
          : {}
      const response = await fetch(`${origin}/mcp`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': era === 'modern' ? MODERN_PROTOCOL_VERSION : '2025-11-25',
          'mcp-method': 'tools/call',
          'mcp-name': 'slow',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'slow', _meta: { ...meta, progressToken: 'cancel-test' } },
        }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/event-stream')
      controller.abort()
      await vi.waitFor(async () => {
        const signals = await readSignals()
        expect(signals).toEqual({ started: before.started + 1, aborted: before.aborted + 1 })
      })
    },
  )
})
