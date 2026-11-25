import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, normalize } from 'pathe'
import { build as build3, createNitro as nitro3 } from 'nitro/builder'
import { build as build2, createNitro as nitro2 } from 'nitropack/core'
import mcp3 from '../src/module/index.ts'
import mcp2 from '../src/module/nitro2.ts'
import { expect, it } from 'vitest'

const toolkit = normalize(fileURLToPath(new URL('../src/runtime/index.ts', import.meta.url)))
const resource = 'http://localhost/runtime/mcp'

it.each([2, 3])(
  'serves runtime OAuth discovery and authorization in built Nitro %s',
  async (version) => {
    const root = normalize(await realpath(await mkdtemp(join(tmpdir(), 'mcp-oauth-build-'))))
    await mkdir(join(root, 'server/mcp/tools'), { recursive: true })
    await writeFile(
      join(root, 'server/mcp/index.ts'),
      `
import { defineMcpServer, createMcpOAuth } from ${JSON.stringify(toolkit)}
export default defineMcpServer({
  oauth: createMcpOAuth({
    resource: ${JSON.stringify(resource)}, authorizationServers: ['https://auth.example.com'],
    verify(token, event) {
      if (!['member', 'outsider'].includes(token)) return false
      event.context.oauth = { sub: token, scope: 'read' }
      return true
    },
  }),
  authorize: identity => identity.sub === 'member',
})
`,
    )
    await writeFile(
      join(root, 'server/mcp/tools/who.ts'),
      `
import { defineMcpTool } from ${JSON.stringify(toolkit)}
export default defineMcpTool({ scopes: ['read'], handler: event => event.context.oauth.sub })
`,
    )
    const config = { rootDir: root, dev: false, alias: { 'nitro-mcp-toolkit': toolkit } }
    const moduleOptions = { route: '/runtime/mcp' }
    async function start() {
      if (version === 3) {
        const nitro = await nitro3({
          ...config,
          preset: 'standard',
          modules: [mcp3(moduleOptions)],
        })
        await build3(nitro)
        const entry: { default: { fetch: (request: Request) => Promise<Response> } } = await import(
          `${nitro.options.output.serverDir}/index.mjs`
        )
        return { fetch: entry.default.fetch, close: () => nitro.close() }
      }
      const nitro = await nitro2({
        ...config,
        preset: 'node-listener',
        modules: [mcp2(moduleOptions)],
      })
      await build2(nitro)
      const entry: { listener: Parameters<typeof createServer>[0] } = await import(
        `${nitro.options.output.serverDir}/index.mjs`
      )
      const server = createServer(entry.listener)
      server.listen(0, '127.0.0.1')
      await once(server, 'listening')
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('Missing fixture port')
      return {
        fetch: (request: Request) =>
          fetch(
            new Request(
              `http://127.0.0.1:${address.port}${new URL(request.url).pathname}`,
              request,
            ),
          ),
        async close() {
          server.closeAllConnections()
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          )
          await nitro.close()
        },
      }
    }
    const server = await start()
    try {
      const metadata = await server.fetch(
        new Request('http://localhost/.well-known/oauth-protected-resource/runtime/mcp'),
      )
      expect(await metadata.json()).toMatchObject({
        resource,
        authorization_servers: ['https://auth.example.com'],
      })
      for (const revision of ['2025-11-25', '2026-07-28']) {
        for (const [token, status] of [
          ['', 401],
          ['invalid', 401],
          ['outsider', 403],
          ['member', 200],
        ] as const) {
          const response = await server.fetch(
            new Request(resource, {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json, text/event-stream',
                'mcp-protocol-version': revision,
                ...(token ? { authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: { name: 'who', arguments: {} },
              }),
            }),
          )
          expect(response.status).toBe(status)
          if (status === 401)
            expect(response.headers.get('www-authenticate')).toContain('resource_metadata=')
          if (status === 200) expect(await response.text()).toContain('member')
          else await response.body?.cancel()
        }
      }
    } finally {
      await server.close()
      await rm(root, { recursive: true, force: true })
    }
  },
  60_000,
)
