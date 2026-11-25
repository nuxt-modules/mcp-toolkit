import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const packageDir = join(root, 'packages/nitro-mcp-toolkit')
const temporary = await mkdtemp(join(tmpdir(), 'nitro-mcp-consumer-'))
const engine = process.env.MCP_TEST_ENGINE_TARBALL
const metadata = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'))
const run = (command: string, args: string[], cwd = temporary) =>
  execFileSync(command, args, { cwd, stdio: 'inherit' })

try {
  run('pnpm', ['pack', '--pack-destination', temporary], packageDir)
  const tarball = join(temporary, `${metadata.name}-${metadata.version}.tgz`)
  await writeFile(
    join(temporary, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      ...(engine ? { overrides: { 'h3-mcp': `file:${engine}` } } : {}),
      dependencies: {
        'nitro-mcp-toolkit': `file:${tarball}`,
        'h3': metadata.dependencies.h3,
        '@modelcontextprotocol/client': metadata.devDependencies['@modelcontextprotocol/client'],
        'typescript': metadata.devDependencies.typescript,
        '@types/node': '26.2.0',
        'zod': metadata.devDependencies.zod,
      },
    }),
  )
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'])
  const runtimeOnly = JSON.parse(await readFile(join(temporary, 'package-lock.json'), 'utf8'))
  assert(!runtimeOnly.packages['node_modules/nitro'], 'runtime-only installs must not pull Nitro')
  assert(!runtimeOnly.packages['node_modules/nitropack'], 'runtime-only installs must not pull Nitro 2')
  assert(!runtimeOnly.packages['node_modules/better-auth'], 'runtime-only installs must not pull Better Auth')
  await writeFile(join(temporary, 'optional-peers.ts'), `
import assert from 'node:assert/strict'
import { createMcpHandler, defineMcpServer } from 'nitro-mcp-toolkit'
assert.throws(() => import.meta.resolve('better-auth'), { code: 'ERR_MODULE_NOT_FOUND' })
assert.match(import.meta.resolve('nitro-mcp-toolkit/oauth/better-auth'), /better-auth\\.mjs$/)
await assert.rejects(import('nitro-mcp-toolkit/oauth/better-auth'), { code: 'ERR_MODULE_NOT_FOUND' })
const handler = createMcpHandler(defineMcpServer({ auth: { schemes: ['bearer'], validate: ({ token }) => token === 'consumer-token' } }))
const response = await handler.fetch(new Request('http://localhost/mcp', {
  method: 'POST',
  headers: { authorization: 'Bearer consumer-token', 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
}))
assert.equal(response.status, 200)
await response.body?.cancel()
console.log('Base package loaded and served a bearer-only endpoint without Better Auth.')
`)
  run(process.execPath, ['optional-peers.ts'])
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    `nitro@${metadata.devDependencies.nitro}`,
    `nitropack@${metadata.devDependencies.nitropack}`,
  ])

  await cp(join(root, 'apps/nitro-playground'), join(temporary, 'playground'), {
    recursive: true,
    filter: path =>
      !['node_modules', '.nitro', '.output', '.turbo'].some(part =>
        path.split(/[\\/]/).includes(part),
      ),
  })
  await writeFile(
    join(temporary, 'check.ts'),
    `
import { createMcpHandler, defineMcpAuth, defineMcpTool, toolResult } from 'nitro-mcp-toolkit'
import type { EmbeddedResource, ResourceLink, StandardTypedV1 } from 'nitro-mcp-toolkit'
import { clerk } from 'nitro-mcp-toolkit/oauth/clerk'
import { okta } from 'nitro-mcp-toolkit/oauth/okta'
import { workos } from 'nitro-mcp-toolkit/oauth/workos'
import mcp from 'nitro-mcp-toolkit/module'
import mcp2 from 'nitro-mcp-toolkit/module/nitro2'
import { createMcpTestClient } from 'nitro-mcp-toolkit/testing'
import { z } from 'zod'
const auth = defineMcpAuth({ schemes: ['bearer'], validate: ({ token }, event) => token === 'consumer-token' && event.req.headers.get('authorization') === 'Bearer consumer-token' })
const health = defineMcpTool({ name: 'health', outputSchema: z.object({ status: z.enum(['ok', 'degraded']), checks: z.array(z.enum(['ok', 'degraded'])) }), handler: async () => ({ status: 'ok', checks: ['ok', 'degraded'] }) })
const handler = createMcpHandler({ auth, tools: [defineMcpTool({ name: 'value', _meta: { 'consumer/extension': true }, outputSchema: z.object({ n: z.number() }), handler: () => toolResult({ content: [], structuredContent: { n: 1 } }) })] })
const schema: StandardTypedV1 = z.object({ n: z.number() })
const link: ResourceLink = { type: 'resource_link', uri: 'docs://example', name: 'example' }
const embedded: EmbeddedResource = { type: 'resource', resource: { uri: 'docs://example', text: 'example' } }
const options = { auth: './server/auth.ts', dir: ['server/mcp', 'layers/base/server/mcp'], include: { tools: ['#consumer/tool.ts'], plugins: ['#consumer/plugins.ts'] }, session: { enabled: true, maxSessions: 10 }, logging: true, limits: { maxBodySize: 8192 } } as const
void [mcp(options), mcp2(options), schema, link, embedded, health]
void handler.fetch(new Request('http://localhost/mcp'), { user: 'consumer' })
await using client = await createMcpTestClient(handler, { headers: { authorization: 'Bearer consumer-token' } })
await client.callTool({ name: 'value' })
void [clerk, okta, workos, mcp, mcp2]
`,
  )
  await writeFile(
    join(temporary, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'NodeNext',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      files: ['check.ts'],
    }),
  )
  run(process.execPath, ['node_modules/typescript/bin/tsc'])
  run(process.execPath, ['check.ts'])
  await cp(
    join(root, 'packages/nitro-mcp-toolkit/test/fixtures/consumer/runtime.ts'),
    join(temporary, 'runtime.ts'),
  )
  run(process.execPath, ['runtime.ts'])
  for (const runtime of (process.env.MCP_TEST_RUNTIMES ?? '').split(',').filter(Boolean)) {
    assert(['bun', 'deno'].includes(runtime), `Unknown test runtime: ${runtime}`)
    run(
      runtime,
      runtime === 'deno'
        ? ['run', '--no-lock', '--allow-read', '--allow-env', 'runtime.ts']
        : ['run', 'runtime.ts'],
    )
  }
  if (engine) {
    await cp(
      join(root, 'packages/nitro-mcp-toolkit/test/fixtures/consumer/engine-cancellation.ts'),
      join(temporary, 'engine-cancellation.ts'),
    )
    run(process.execPath, ['engine-cancellation.ts'])
  }
  await writeFile(
    join(temporary, 'verify.ts'),
    `
import assert from 'node:assert/strict'
import { build, createNitro } from 'nitro/builder'
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'
const nitro = await createNitro({ rootDir: new URL('./playground', import.meta.url).pathname, preset: 'standard', dev: false })
try {
  await build(nitro)
  const { default: server } = await import('./playground/.output/server/index.mjs')
  for (const era of ['modern', 'legacy'] as const) {
    await using client = await createMcpTestClient(server, { era })
    assert.match(textOf(await client.callTool({ name: 'greet', arguments: { name: 'Consumer' } })), /Hello Consumer/)
    const denied = await server.fetch(new Request('http://localhost/admin/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }))
    assert.equal(denied.status, 401)
    await using admin = await createMcpTestClient(server, { era, url: 'http://localhost/admin/mcp', headers: { authorization: 'Bearer dev-admin-token' } })
    assert(!(await admin.listTools()).tools.some(tool => tool.name === 'greet'))
  }
} finally { await nitro.close() }
`,
  )
  run(process.execPath, ['verify.ts'])
  await writeFile(join(temporary, 'entry-nitro2.ts'), `
import { useNitroApp } from 'nitropack/runtime'
export default {
  fetch(request) {
    const url = new URL(request.url)
    return useNitroApp().localFetch(url.pathname + url.search, {
      method: request.method, headers: request.headers, body: request.body,
      signal: request.signal, duplex: 'half',
    })
  },
}
`)
  await writeFile(join(temporary, 'verify-nitro2.ts'), `
import assert from 'node:assert/strict'
import { createNitro, build } from 'nitropack/core'
import mcp from 'nitro-mcp-toolkit/module/nitro2'
import { createMcpTestClient, textOf } from 'nitro-mcp-toolkit/testing'
const nitro = await createNitro({
  rootDir: new URL('./', import.meta.url).pathname,
  preset: 'node-server', entry: './entry-nitro2.ts',
  modules: [mcp({ dir: 'playground/server/mcp' })],
})
try {
  await build(nitro)
  const { default: server } = await import('./.output/server/index.mjs')
  for (const era of ['modern', 'legacy'] as const) {
    await using client = await createMcpTestClient(server, { era })
    assert.match(textOf(await client.callTool({ name: 'greet', arguments: { name: 'Consumer' } })), /Hello Consumer/)
  }
} finally { await nitro.close() }
`)
  run(process.execPath, ['verify-nitro2.ts'])
  await cp(
    join(root, 'packages/nitro-mcp-toolkit/test/fixtures/consumer/tree-shaking.ts'),
    join(temporary, 'tree-shaking.ts'),
  )
  run(process.execPath, ['tree-shaking.ts'])
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    `better-auth@${metadata.devDependencies['better-auth']}`,
  ])
  await cp(
    join(root, 'packages/nitro-mcp-toolkit/test/fixtures/consumer/oauth-better-auth.ts'),
    join(temporary, 'oauth-better-auth.ts'),
  )
  await writeFile(
    join(temporary, 'tsconfig.better-auth.json'),
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { types: ['node'] },
      files: ['oauth-better-auth.ts'],
    }),
  )
  run(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.better-auth.json'])
  run(process.execPath, ['oauth-better-auth.ts'])
  console.log('Packed runtime, types, optional Better Auth adapter and Nitro 2/3 endpoints passed.')
}
finally {
  await rm(temporary, { recursive: true, force: true })
}
