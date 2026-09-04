import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { cpus, release, tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { join, resolve } from 'pathe'
import { H3Event, toResponse } from 'h3'
import { defineMcpHandler, defineTool } from 'h3-mcp'
import { z } from 'zod'

const protocol = '2026-07-28'
type Fetcher = (request: Request) => Promise<Response>
type Fixture = { fetch: Fetcher; url: string; close: () => Promise<void> }

async function compare() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string' },
      repeats: { type: 'string', default: '3' },
      time: { type: 'string', default: '1000' },
    },
  })
  assert(
    positionals.length >= 1 && positionals.length <= 2,
    'Usage: pnpm bench:nitro <baseline-ref> [candidate-ref=HEAD] [--output <directory>] [--repeats 3] [--time 1000]',
  )
  const repeats = Number(values.repeats)
  const time = Number(values.time)
  assert(Number.isSafeInteger(repeats) && repeats > 0, 'repeats must be a positive integer')
  assert(Number.isSafeInteger(time) && time > 0, 'time must be a positive number of milliseconds')
  const packageDir = fileURLToPath(new URL('..', import.meta.url))
  const root = resolve(packageDir, '../..')
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  const baseline = git('rev-parse', '--verify', '--end-of-options', `${positionals[0]}^{commit}`)
  const candidate = git(
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${positionals[1] ?? 'HEAD'}^{commit}`,
  )
  const startedAt = new Date().toISOString()
  const output = values.output
    ? resolve(values.output)
    : join(packageDir, 'benchmarks/results', startedAt.replaceAll(':', '-'))
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
  const dependencies = Object.fromEntries(
    ['vitest', 'h3', 'h3-mcp', 'jose', 'zod'].map((name) => [
      name,
      z
        .object({ version: z.string() })
        .parse(
          JSON.parse(readFileSync(join(packageDir, 'node_modules', name, 'package.json'), 'utf8')),
        ).version,
    ]),
  )
  const metadata = {
    startedAt,
    baseline,
    candidate,
    harnessRevision: git('rev-parse', 'HEAD'),
    harnessHash: hash(import.meta.filename),
    lockfileHash: hash(join(root, 'pnpm-lock.yaml')),
    configHash: hash(join(packageDir, 'vitest.config.ts')),
    dependencies,
    dependencyMode: 'both revisions use the current installed dependencies',
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: release(),
      cpu: cpus()[0]?.model,
    },
    repeats,
    time,
    iterations: 100,
    warmupTime: 500,
    warmupIterations: 20,
    throws: true,
    protocol,
  }
  mkdirSync(resolve(output, '..'), { recursive: true })
  mkdirSync(output)
  const temporary = mkdtempSync(join(tmpdir(), 'nitro-benchmark-'))
  try {
    for (const [name, revision] of Object.entries({ baseline, candidate })) {
      const directory = join(temporary, name)
      mkdirSync(directory)
      const archive = execFileSync(
        'git',
        [
          'archive',
          revision,
          'packages/nitro-mcp-toolkit/src',
          'packages/nitro-mcp-toolkit/package.json',
        ],
        { cwd: root },
      )
      execFileSync('tar', ['-xf', '-', '-C', directory], { input: archive })
      symlinkSync(
        join(packageDir, 'node_modules'),
        join(directory, 'packages/nitro-mcp-toolkit/node_modules'),
        'junction',
      )
    }
    const summary = [
      '# Catalog comparison',
      `Baseline: \`${baseline}\`\n\nCandidate: \`${candidate}\``,
      'Vitest/Tinybench statistics for each repeat follow. Comparisons use the previous repeat’s baseline when the candidate runs first. Read error estimates and repeat variation before interpreting small changes.',
    ]
    for (let repeat = 1; repeat <= repeats; repeat++) {
      for (const revision of repeat % 2 ? ['baseline', 'candidate'] : ['candidate', 'baseline']) {
        const filename = `${revision}-${repeat}`
        const args = [
          join(packageDir, 'node_modules/vitest/vitest.mjs'),
          'bench',
          '--run',
          '--outputJson',
          join(output, `${filename}.json`),
        ]
        if (revision === 'candidate')
          args.push('--compare', join(output, `baseline-${repeat % 2 ? repeat : repeat - 1}.json`))
        process.stderr.write(`Repeat ${repeat}/${repeats}: ${revision}\n`)
        const stdout = execFileSync(process.execPath, args, {
          cwd: packageDir,
          encoding: 'utf8',
          timeout: 300_000,
          maxBuffer: 32 * 1024 * 1024,
          env: {
            ...process.env,
            NO_COLOR: '1',
            FORCE_COLOR: '0',
            MCP_BENCH_ENTRY: pathToFileURL(
              join(temporary, revision, 'packages/nitro-mcp-toolkit/src/runtime/index.ts'),
            ).href,
            MCP_BENCH_TIME: String(time),
          },
        })
        writeFileSync(join(output, `${filename}.txt`), stdout)
        summary.push(`## ${revision}, repeat ${repeat}\n\n\`\`\`text\n${stdout}\n\`\`\``)
        process.stdout.write(stdout)
      }
    }
    cpSync(import.meta.filename, join(output, 'catalog.bench.ts'))
    cpSync(join(packageDir, 'vitest.config.ts'), join(output, 'vitest.config.ts'))
    cpSync(join(root, 'pnpm-lock.yaml'), join(output, 'pnpm-lock.yaml'))
    writeFileSync(join(output, 'metadata.json'), JSON.stringify(metadata, null, 2) + '\n')
    writeFileSync(join(output, 'summary.md'), summary.join('\n\n') + '\n')
    process.stderr.write(`Saved benchmark to ${output}\n`)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

async function registerBenchmarks() {
  const { bench, describe, beforeAll, afterAll } = await import('vitest')
  const { createMcpHandler, defineMcpTool }: typeof import('../src/runtime/index.ts') =
    await import(process.env.MCP_BENCH_ENTRY!)
  const fixtures = new Map<string, Fixture>()
  beforeAll(async () => {
    for (const count of [10, 100, 1000]) {
      const definitions = Array.from({ length: count }, (_, i) => ({
        name: `tool-${i}`,
        inputSchema: z.object({ value: z.number() }),
        handler: ({ value }: { value: number }) => ({
          content: [{ type: 'text' as const, text: String(value + 1) }],
        }),
      }))
      const bare = defineMcpHandler({
        name: 'nitro-mcp-server',
        version: '0.0.0',
        tools: definitions.map((definition) => defineTool(definition)),
      })
      const toolkit = createMcpHandler({
        tools: definitions.map((definition) => defineMcpTool(definition)),
      })
      fixtures.set(`${count}/toolkit`, await createFixture(toolkit.fetch))
      fixtures.set(
        `${count}/bare`,
        await createFixture(async (request) => {
          const event = new H3Event(request)
          return toResponse(await bare(event), event)
        }),
      )
    }
  })
  afterAll(async () => {
    await Promise.all([...fixtures.values()].map((fixture) => fixture.close()))
  })
  for (const count of [10, 100, 1000]) {
    for (const transport of ['memory', 'http'] as const) {
      for (const workload of ['call', 'catalog', 'subset'] as const) {
        describe(`${count}/${transport}/${workload}`, () => {
          for (const implementation of workload === 'subset' ? ['toolkit'] : ['toolkit', 'bare']) {
            bench(
              implementation,
              async () => {
                const fixture = fixtures.get(`${count}/${implementation}`)
                assert(fixture, 'Benchmark fixture was not prepared')
                await exercise(fixture, count, transport, workload)
              },
              {
                time: Number(process.env.MCP_BENCH_TIME),
                iterations: 100,
                warmupTime: 500,
                warmupIterations: 20,
                throws: true,
              },
            )
          }
        })
      }
    }
  }
}

async function createFixture(serve: Fetcher): Promise<Fixture> {
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
  return {
    fetch: serve,
    url,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}

export async function exercise(
  fixture: Pick<Fixture, 'fetch' | 'url'>,
  count: number,
  transport: 'memory' | 'http',
  workload: 'call' | 'catalog' | 'subset',
) {
  let cursor: string | undefined
  let found = 0
  let pages = 0
  const cursors = new Set<string>()
  do {
    const method = workload === 'catalog' ? 'tools/list' : 'tools/call'
    const name = `tool-${count - 1}`
    const request = new Request(fixture.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': protocol,
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
            'io.modelcontextprotocol/protocolVersion': protocol,
            'io.modelcontextprotocol/clientCapabilities': {},
          },
        },
      }),
    })
    const response = await (transport === 'http' ? fetch(request) : fixture.fetch(request))
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert(payload && typeof payload === 'object' && 'result' in payload, JSON.stringify(payload))
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

if (import.meta.main) await compare()
else if (process.env.MCP_BENCH_ENTRY) await registerBenchmarks()
