import assert from 'node:assert/strict'
import { execFileSync, fork } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { cpus, release, tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { build, createNitro } from 'nitro/builder'
import { dirname, join, relative, resolve } from 'pathe'
import { z } from 'zod'

const scenarios = ['minimal', 'oauth', 'discovery', 'catalog', 'bare'] as const
type Scenario = (typeof scenarios)[number]

export function requestOptions(count: number, oauth: boolean, subset = 0): RequestInit {
  const name = `tool-${count - 1}`
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': 'tools/call',
      'mcp-name': name,
      ...(oauth ? { authorization: 'Bearer benchmark-token' } : {}),
      ...(subset
        ? {
            'x-mcp-tools': Array.from({ length: subset }, (_, i) => `tool-${count - 1 - i}`).join(
              ',',
            ),
          }
        : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name,
        arguments: { value: 41 },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  }
}

async function measure(entry: string, scenario: Scenario, profile: string | undefined) {
  const request = requestOptions(
    scenario === 'catalog' || scenario === 'bare' ? 1000 : 1,
    scenario === 'oauth',
  )
  const started = performance.now()
  const child = fork(fileURLToPath(new URL('./consumer-worker.ts', import.meta.url)), [], {
    execArgv: [],
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    env: {
      ...process.env,
      MCP_CONSUMER_ENTRY: entry,
      MCP_CONSUMER_REQUEST: JSON.stringify(request),
      MCP_CONSUMER_PROFILE: profile,
    },
  })
  const timer = setTimeout(() => child.kill(), 60_000)
  const next = () =>
    Promise.race([
      once(child, 'message').then(([message]: unknown[]) => message),
      once(child, 'exit').then(([code]) => {
        throw new Error(`Consumer exited before replying: ${code}`)
      }),
    ])
  try {
    const ready = z
      .object({
        url: z.string().url(),
        importMs: z.number().nonnegative(),
        firstRequestMs: z.number().nonnegative(),
      })
      .parse(await next())
    const processToReadyMs = performance.now() - started
    if (profile) {
      const profiledRequest = requestOptions(1000, false, scenario === 'catalog' ? 100 : 0)
      for (let i = 0; i < 200; i++) await invoke(ready.url, profiledRequest)
      let reply = next()
      child.send('profile')
      assert.equal(await reply, 'profiling')
      for (let i = 0; i < 3000; i++) await invoke(ready.url, profiledRequest)
      reply = next()
      child.send('stop')
      assert.equal(await reply, 'saved')
    }
    const exited = once(child, 'exit')
    child.send('close')
    assert.equal((await exited)[0], 0)
    return { importMs: ready.importMs, firstRequestMs: ready.firstRequestMs, processToReadyMs }
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null) child.kill()
  }
}

async function invoke(url: string, request: RequestInit) {
  const response = await fetch(url, request)
  assert.equal(response.status, 200)
  const payload = await response.json()
  assert(payload && typeof payload === 'object' && 'result' in payload)
  const result = payload.result
  assert(result && typeof result === 'object' && 'content' in result)
  assert(!('isError' in result && result.isError))
  assert.deepEqual(result.content, [{ type: 'text', text: '42' }])
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string' },
      repeats: { type: 'string', default: '5' },
      profile: { type: 'boolean', default: false },
    },
  })
  assert(
    positionals.length <= 1,
    'Usage: pnpm bench:consumer [ref=HEAD] [--repeats 5] [--profile] [--output directory]',
  )
  const repeats = Number(values.repeats)
  assert(Number.isSafeInteger(repeats) && repeats > 0)
  const packageDir = fileURLToPath(new URL('..', import.meta.url))
  const root = resolve(packageDir, '../..')
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const revision = git(
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${positionals[0] ?? 'HEAD'}^{commit}`,
  )
  const output = resolve(
    values.output ??
      join(
        packageDir,
        'benchmarks/results',
        `consumer-${new Date().toISOString().replaceAll(':', '-')}`,
      ),
  )
  await mkdir(dirname(output), { recursive: true })
  await mkdir(output)
  const temporary = await mkdtemp(join(tmpdir(), 'nitro-consumer-benchmark-'))
  const json = (path: string, value: unknown) =>
    writeFile(path, JSON.stringify(value, null, 2) + '\n')
  try {
    const archive = execFileSync('git', ['archive', revision, 'packages/nitro-mcp-toolkit'], {
      cwd: root,
    })
    await writeFile(join(output, 'source.tar'), archive)
    execFileSync('tar', ['-xf', '-', '-C', temporary], { input: archive })
    const snapshot = join(temporary, 'packages/nitro-mcp-toolkit')
    await symlink(join(packageDir, 'node_modules'), join(snapshot, 'node_modules'), 'junction')
    execFileSync(process.execPath, [join(packageDir, 'node_modules/obuild/dist/cli.mjs')], {
      cwd: snapshot,
      stdio: 'inherit',
    })
    const modules = join(temporary, 'node_modules')
    await mkdir(modules)
    await symlink(snapshot, join(modules, 'nitro-mcp-toolkit'), 'junction')
    for (const name of ['h3', 'h3-mcp', 'nitro', 'zod'])
      await symlink(join(packageDir, 'node_modules', name), join(modules, name), 'junction')
    const { default: mcp }: typeof import('../src/module/index.ts') = await import(
      pathToFileURL(join(snapshot, 'dist/module/index.mjs')).href
    )
    const results = []
    for (const scenario of scenarios) {
      const app = join(temporary, scenario)
      const count = scenario === 'catalog' || scenario === 'bare' ? 1000 : 1
      const definition = `(i: number) => ({
  name: 'tool-' + i,
  inputSchema: z.object({ value: z.number() }),
  handler: ({ value }: { value: number }) => ({
    content: [{ type: 'text' as const, text: String(value + 1) }],
  }),
})`
      let source: string
      if (scenario === 'discovery') {
        source = `import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'
export default defineMcpTool((${definition})(0))
`
      } else if (scenario === 'bare') {
        source = `import { defineMcpHandler, defineTool } from 'h3-mcp'
import { z } from 'zod'
export default defineMcpHandler({
  tools: Array.from({ length: ${count} }, (_, i) => defineTool((${definition})(i))),
})
`
      } else {
        source = `import { createMcpHandler, defineMcpTool${scenario === 'oauth' ? ', createMcpOAuth' : ''} } from 'nitro-mcp-toolkit'
import { z } from 'zod'
export default createMcpHandler({
  tools: Array.from({ length: ${count} }, (_, i) => defineMcpTool((${definition})(i))),
  ${
    scenario === 'oauth'
      ? `auth: createMcpOAuth({
    resource: 'https://example.com/mcp',
    authorizationServers: ['https://auth.example.com'],
    verify: (token) => token === 'benchmark-token',
  }).auth,`
      : ''
  }
})
`
      }
      const file = join(
        app,
        scenario === 'discovery' ? 'server/mcp/tools/tool-0.ts' : 'server/routes/mcp.ts',
      )
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, source)
      await cp(app, join(output, scenario, 'fixture'), { recursive: true })
      const contributions: { id: string; renderedLength: number }[] = []
      const nitro = await createNitro({
        rootDir: app,
        serverDir: 'server',
        compatibilityDate: '2026-07-01',
        dev: false,
        preset: 'standard',
        builder: 'rolldown',
        noExternals: true,
        minify: true,
        modules: scenario === 'discovery' ? [mcp()] : [],
        rolldownConfig: {
          plugins: [
            {
              name: 'measure-consumer',
              generateBundle(_options, bundle) {
                for (const chunk of Object.values(bundle)) {
                  if (chunk.type === 'chunk')
                    for (const [id, module] of Object.entries(chunk.modules)) {
                      contributions.push({
                        id: id.replaceAll(temporary, '<fixture>').replaceAll(root, '<repo>'),
                        renderedLength: module.renderedLength,
                      })
                    }
                }
              },
            },
          ],
        },
      })
      try {
        await build(nitro)
        const serverDir = nitro.options.output.serverDir
        await cp(serverDir, join(output, scenario, 'server'), { recursive: true })
        const files = []
        for (const path of await readdir(serverDir, { recursive: true })) {
          if (!/\.[cm]?js$/.test(path)) continue
          const contents = await readFile(join(serverDir, path))
          files.push({ path, bytes: contents.byteLength, gzipBytes: gzipSync(contents).byteLength })
        }
        if (scenario === 'minimal' || scenario === 'discovery') {
          assert(
            !contributions.some(
              ({ id, renderedLength }) => id.includes('/jose/') && renderedLength > 0,
            ),
            'Unused OAuth code must be removed from the consumer',
          )
        }
        await json(join(output, scenario, 'modules.json'), contributions)
        await json(join(output, scenario, 'files.json'), files)
        const startup = []
        for (let repeat = 0; repeat < repeats; repeat++)
          startup.push(
            await measure(
              join(serverDir, 'index.mjs'),
              scenario,
              values.profile &&
                repeat === repeats - 1 &&
                (scenario === 'catalog' || scenario === 'bare')
                ? join(output, scenario, 'http.cpuprofile')
                : undefined,
            ),
          )
        results.push({
          scenario,
          bytes: files.reduce((sum, file) => sum + file.bytes, 0),
          gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
          startup,
        })
      } finally {
        await nitro.close()
      }
    }
    await json(join(output, 'results.json'), results)
    const lockfile = await readFile(join(root, 'pnpm-lock.yaml'))
    await writeFile(join(output, 'pnpm-lock.yaml'), lockfile)
    for (const file of ['consumer.ts', 'consumer-worker.ts'])
      await cp(join(packageDir, 'benchmarks', file), join(output, file))
    await json(join(output, 'metadata.json'), {
      revision,
      harnessHashes: Object.fromEntries(
        await Promise.all(
          ['consumer.ts', 'consumer-worker.ts'].map(async (file) => [
            file,
            createHash('sha256')
              .update(await readFile(join(output, file)))
              .digest('hex'),
          ]),
        ),
      ),
      harnessRevision: git('rev-parse', 'HEAD'),
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: release(),
      cpu: cpus()[0]?.model,
      lockfileHash: createHash('sha256').update(lockfile).digest('hex'),
      repeats,
      dependencies: Object.fromEntries(
        await Promise.all(
          ['nitro', 'obuild', 'h3', 'h3-mcp', 'jose', 'zod'].map(async (name) => [
            name,
            JSON.parse(
              await readFile(join(packageDir, 'node_modules', name, 'package.json'), 'utf8'),
            ).version,
          ]),
        ),
      ),
      build: {
        serverDir: 'server',
        compatibilityDate: '2026-07-01',
        preset: 'standard',
        builder: 'rolldown',
        noExternals: true,
        minify: true,
      },
      profile: values.profile
        ? {
            requests: 3000,
            warmup: 200,
            concurrency: 1,
            process: 'server only, including HTTP adapter',
            catalogSelection: 100,
            bareSelection: 'unfiltered',
          }
        : false,
    })
    await writeFile(
      join(output, 'summary.md'),
      [
        '# Consumer measurements',
        `Revision: \`${revision}\``,
        '| Scenario | JavaScript bytes | Gzip bytes |',
        '| --- | ---: | ---: |',
        ...results.map(
          ({ scenario, bytes, gzipBytes }) => `| ${scenario} | ${bytes} | ${gzipBytes} |`,
        ),
        '',
        'Sizes sum all emitted JavaScript files; gzip compresses each file separately. Startup samples in results.json use fresh Node processes with warm filesystem caches. These are local measurements, not deployment cold starts. OAuth uses a local opaque-token verifier, not a JWT network round trip.',
      ].join('\n') + '\n',
    )
    console.table(results.map(({ scenario, bytes, gzipBytes }) => ({ scenario, bytes, gzipBytes })))
    console.log(`Saved consumer measurements to ${relative(root, output)}`)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
