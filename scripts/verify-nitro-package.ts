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
        h3: metadata.devDependencies.h3,
        '@modelcontextprotocol/client': metadata.devDependencies['@modelcontextprotocol/client'],
        typescript: metadata.devDependencies.typescript,
        '@types/node': '26.2.0',
        zod: metadata.devDependencies.zod,
      },
    }),
  )
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'])
  const runtimeOnly = JSON.parse(await readFile(join(temporary, 'package-lock.json'), 'utf8'))
  assert(!runtimeOnly.packages['node_modules/nitro'], 'runtime-only installs must not pull Nitro')
  run('npm', [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    `nitro@${metadata.devDependencies.nitro}`,
  ])

  await cp(join(root, 'apps/nitro-playground'), join(temporary, 'playground'), {
    recursive: true,
    filter: (path) =>
      !['node_modules', '.nitro', '.output', '.turbo'].some((part) =>
        path.split(/[\\/]/).includes(part),
      ),
  })
  await writeFile(
    join(temporary, 'check.ts'),
    `
import { createMcpHandler, defineMcpTool, toolResult } from 'nitro-mcp-toolkit'
import { clerk } from 'nitro-mcp-toolkit/oauth/clerk'
import { okta } from 'nitro-mcp-toolkit/oauth/okta'
import { workos } from 'nitro-mcp-toolkit/oauth/workos'
import mcp from 'nitro-mcp-toolkit/module'
import { createMcpTestClient } from 'nitro-mcp-toolkit/testing'
import { z } from 'zod'
const handler = createMcpHandler({ tools: [defineMcpTool({ name: 'value', outputSchema: z.object({ n: z.number() }), handler: () => toolResult({ content: [], structuredContent: { n: 1 } }) })] })
await using client = await createMcpTestClient(handler)
await client.callTool({ name: 'value' })
void [clerk, okta, workos, mcp]
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
  if (engine) {
    await cp(
      join(root, 'scripts/fixtures/engine-cancellation.ts'),
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
  console.log('Packed runtime, types, ordinary peer resolution and both Nitro endpoints passed.')
} finally {
  await rm(temporary, { recursive: true, force: true })
}
