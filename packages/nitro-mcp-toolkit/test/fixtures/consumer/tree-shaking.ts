import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { build as build2, createNitro as createNitro2 } from 'nitropack/core'
import { build as build3, createNitro as createNitro3 } from 'nitro/builder'
import { dirname, join, normalize } from 'pathe'
import mcp2 from 'nitro-mcp-toolkit/module/nitro2'
import mcp3 from 'nitro-mcp-toolkit/module'
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'

interface BundleEntry {
  type: string
  modules?: Record<string, { renderedLength: number }>
}

interface ServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

const root = dirname(fileURLToPath(import.meta.url))
const resource = 'http://localhost/mcp'
const issuer = 'https://auth.example.com'
const { privateKey, publicKey } = await generateKeyPair('ES256')
const jwk = { ...(await exportJWK(publicKey)), kid: 'fixture', alg: 'ES256' }
const jwks = createServer((_request, response) => {
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify({ keys: [jwk] }))
})
await new Promise<void>((resolve) => jwks.listen(0, '127.0.0.1', resolve))
const address = jwks.address()
assert(address && typeof address !== 'string')

async function sign(audience = resource, expiration = '2m') {
  return new SignJWT({ scope: 'account:read' })
    .setProtectedHeader({ alg: 'ES256', kid: 'fixture' })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject('reader')
    .setExpirationTime(expiration)
    .sign(privateKey)
}

try {
  for (const framework of [2, 3] as const) {
    for (const oauth of [false, true]) {
      const directory = await mkdtemp(
        join(root, `tree-shaking-nitro${framework}-${oauth ? 'oauth' : 'bearer'}-`),
      )
      const tools = join(directory, 'server/mcp/tools')
      await mkdir(tools, { recursive: true })
      await writeFile(
        join(tools, 'account.ts'),
        `
import { defineMcpTool } from 'nitro-mcp-toolkit'
export default defineMcpTool({
  ${oauth ? "scopes: ['account:read']," : ''}
  handler: event => event.context.oauth?.sub ?? 'static-credential',
})
`,
      )
      const rendered = new Map<string, number>()
      const rollupConfig = {
        plugins: [
          {
            name: 'fixture:tree-shaking',
            generateBundle(_options: unknown, bundle: Record<string, BundleEntry>) {
              for (const entry of Object.values(bundle)) {
                for (const [id, module] of Object.entries(entry.modules ?? {})) {
                  rendered.set(normalize(id), module.renderedLength)
                }
              }
            },
          },
        ],
      }
      const options = oauth
        ? {
            oauth: {
              resource,
              authorizationServers: [issuer],
              jwt: { jwks: `http://127.0.0.1:${address.port}/jwks` },
            },
          }
        : { auth: { tokens: ['fixture-token'] } }
      let app: { output: string; build: () => Promise<unknown>; close: () => Promise<void> }
      if (framework === 2) {
        await writeFile(
          join(directory, 'entry.ts'),
          `
import { useNitroApp } from 'nitropack/runtime'
export default { fetch(request) {
  const url = new URL(request.url)
  return useNitroApp().localFetch(url.pathname + url.search, {
    method: request.method, headers: request.headers, body: request.body,
    signal: request.signal, duplex: 'half',
  })
} }
`,
        )
        const nitro = await createNitro2({
          rootDir: directory,
          dev: false,
          preset: 'node-server',
          entry: './entry.ts',
          nodeModulesDirs: [join(root, 'node_modules')],
          rollupConfig,
          modules: [mcp2(options)],
        })
        app = {
          output: nitro.options.output.serverDir,
          build: () => build2(nitro),
          close: () => nitro.close(),
        }
      } else {
        const nitro = await createNitro3({
          rootDir: directory,
          dev: false,
          preset: 'standard',
          rollupConfig,
          modules: [mcp3(options)],
        })
        app = {
          output: nitro.options.output.serverDir,
          build: () => build3(nitro),
          close: () => nitro.close(),
        }
      }
      try {
        await app.build()
        const { default: server }: { default: ServerEntry } = await import(
          pathToFileURL(join(app.output, 'index.mjs')).href
        )
        const handler = { fetch: (request: Request) => Promise.resolve(server.fetch(request)) }
        const token = oauth ? await sign() : 'fixture-token'
        for (const era of ['modern', 'legacy'] as const) {
          await using client = await createMcpTestClient(handler, {
            era,
            headers: { authorization: `Bearer ${token}` },
          })
          assert.equal(
            textOf(await client.callTool({ name: 'account' })),
            oauth ? 'reader' : 'static-credential',
          )
          if (oauth) {
            for (const invalid of [
              await sign('https://other.example.com/mcp'),
              await sign(resource, '-1m'),
            ]) {
              await assert.rejects(
                createMcpTestClient(handler, {
                  era,
                  headers: { authorization: `Bearer ${invalid}` },
                }),
                era === 'modern' ? /401/ : /Unauthorized/,
              )
            }
          }
        }
        const files = (await readdir(app.output, { recursive: true })).map(normalize)
        const javascript = files.filter((file) => /\.(mjs|cjs|js)$/.test(file))
        let bytes = 0
        let gzipBytes = 0
        for (const file of javascript) {
          const data = await readFile(join(app.output, file))
          bytes += data.byteLength
          gzipBytes += gzipSync(data, { level: 9 }).byteLength
        }
        const joseBytes = [...rendered]
          .filter(([id]) => id.includes('/jose/'))
          .reduce((sum, [, bytes]) => sum + bytes, 0)
        console.log(
          JSON.stringify({
            framework,
            oauth,
            javaScriptFiles: javascript.length,
            bytes,
            gzipBytes,
            joseBytes,
          }),
        )
        assert(
          !files.some(
            (file) => file === 'node_modules/jose' || file.startsWith('node_modules/jose/'),
          ),
          'jose must be bundled so unused exports can be removed',
        )
        assert.equal(
          joseBytes > 0,
          oauth,
          'JWT verification must be present only when OAuth uses it',
        )
        assert(
          ![...rendered].some(
            ([id, bytes]) => bytes > 0 && /nitro-mcp-toolkit\/dist\/(module|testing)\//.test(id),
          ),
          'build and testing code must stay outside the server runtime',
        )
      } finally {
        await app.close()
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    jwks.close((error) => (error ? reject(error) : resolve())),
  )
}
