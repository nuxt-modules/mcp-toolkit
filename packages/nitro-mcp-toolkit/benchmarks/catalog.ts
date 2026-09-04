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
import { cpus, release, tmpdir, totalmem } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { join, resolve } from 'pathe'
import { z } from 'zod'
import { createServer } from 'node:http'
import { H3Event, toResponse } from 'h3'
import { defineMcpHandler, defineTool } from 'h3-mcp'

const MODERN_PROTOCOL_VERSION = '2026-07-28'
const warmups = 20

export const measurementSchema = z.object({
  implementation: z.enum(['bare', 'toolkit']),
  count: z.number().int().positive(),
  repeat: z.number().int().nonnegative(),
  transport: z.enum(['memory', 'http']),
  workload: z.enum(['call', 'catalog', 'subset']),
  pages: z.number().int().positive(),
  durations: z.array(z.number().finite().positive()).nonempty(),
})

export type Measurement = z.infer<typeof measurementSchema> & {
  revision: 'baseline' | 'candidate' | 'reference'
}

export function percentile(values: number[], fraction: number) {
  assert(values.length > 0, 'Cannot summarize empty measurements')
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))]!
}

export function summarize(measurements: Measurement[]) {
  const keys = [
    ...new Set(measurements.map((row) => `${row.count}/${row.transport}/${row.workload}`)),
  ]
  return keys.sort().map((key) => {
    const matching = measurements.filter(
      (row) => `${row.count}/${row.transport}/${row.workload}` === key,
    )
    function stats(revision: Measurement['revision']) {
      const rows = matching.filter((row) => row.revision === revision)
      if (rows.length === 0) return undefined
      return {
        p50: percentile(
          rows.map((row) => percentile(row.durations, 0.5)),
          0.5,
        ),
        p95: percentile(
          rows.map((row) => percentile(row.durations, 0.95)),
          0.5,
        ),
      }
    }
    const baseline = stats('baseline')
    const candidate = stats('candidate')
    assert(baseline && candidate, `Missing comparison for ${key}`)
    return {
      workload: key,
      baseline,
      candidate,
      reference: stats('reference'),
      changePercent: (candidate.p50 / baseline.p50 - 1) * 100,
    }
  })
}

export function renderTable(measurements: Measurement[]) {
  return [
    '| Tools / transport / workload | Baseline p50 / p95 (ms) | Candidate p50 / p95 (ms) | p50 change | Bare h3 p50 (ms) |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...summarize(measurements).map(
      (row) =>
        `| ${row.workload} | ${row.baseline.p50.toFixed(4)} / ${row.baseline.p95.toFixed(4)} | ${row.candidate.p50.toFixed(4)} / ${row.candidate.p95.toFixed(4)} | ${row.changePercent.toFixed(1)}% | ${row.reference?.p50.toFixed(4) ?? '—'} |`,
    ),
  ].join('\n')
}

async function compare() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: 'string' },
      samples: { type: 'string', default: '100' },
      repeats: { type: 'string', default: '3' },
      seed: { type: 'string', default: '42' },
    },
  })
  assert(
    positionals.length >= 1 && positionals.length <= 2,
    'Usage: pnpm bench:catalog <baseline-ref> [candidate-ref=HEAD] [--output <directory>] [--samples 100] [--repeats 3] [--seed 42]',
  )
  const samples = Number(values.samples)
  const repeats = Number(values.repeats)
  const seed = Number(values.seed)
  assert(Number.isSafeInteger(samples) && samples > 0, 'samples must be a positive integer')
  assert(Number.isSafeInteger(repeats) && repeats > 0, 'repeats must be a positive integer')
  assert(Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff, 'seed must be a positive uint32')
  const benchmarkDir = fileURLToPath(new URL('.', import.meta.url))
  const packageDir = resolve(benchmarkDir, '..')
  const root = resolve(packageDir, '../..')
  function git(...args: string[]) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  }
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
    : join(benchmarkDir, 'results', startedAt.replaceAll(':', '-'))
  const packagePath = 'packages/nitro-mcp-toolkit'
  const measurements: Measurement[] = []
  let randomState = seed
  function shuffle<T>(items: T[]) {
    for (let i = items.length - 1; i > 0; i--) {
      randomState ^= randomState << 13
      randomState ^= randomState >>> 17
      randomState ^= randomState << 5
      const j = (randomState >>> 0) % (i + 1)
      ;[items[i], items[j]] = [items[j]!, items[i]!]
    }
    return items
  }
  const hash = (contents: string | Buffer) => createHash('sha256').update(contents).digest('hex')
  const dependencies = Object.fromEntries(
    ['h3', 'h3-mcp', 'jose', 'zod'].map((name) => [
      name,
      z
        .object({ version: z.string() })
        .parse(
          JSON.parse(readFileSync(join(packageDir, 'node_modules', name, 'package.json'), 'utf8')),
        ).version,
    ]),
  )
  const metadata = {
    formatVersion: 1,
    startedAt,
    baseline,
    candidate,
    harnessRevision: git('rev-parse', 'HEAD'),
    harnessHashes: { 'catalog.ts': hash(readFileSync(import.meta.filename)) },
    dependencyMode: 'both revisions use the current installed dependencies',
    dependencies,
    lockfileHash: hash(readFileSync(join(root, 'pnpm-lock.yaml'))),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      os: release(),
      cpu: cpus()[0]?.model,
      cpus: cpus().length,
      memory: totalmem(),
    },
    samples,
    warmups,
    repeats,
    seed,
    units: 'milliseconds',
    protocol: MODERN_PROTOCOL_VERSION,
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
        ['archive', revision, `${packagePath}/src`, `${packagePath}/package.json`],
        { cwd: root },
      )
      execFileSync('tar', ['-xf', '-', '-C', directory], { input: archive })
      symlinkSync(
        join(packageDir, 'node_modules'),
        join(directory, packagePath, 'node_modules'),
        'junction',
      )
    }
    for (let repeat = 0; repeat < repeats; repeat++) {
      const jobs = shuffle(
        [10, 100, 1000].flatMap((count) =>
          (['baseline', 'candidate', 'reference'] as const).map((revision) => ({
            revision,
            count,
          })),
        ),
      )
      for (const { revision, count } of jobs) {
        process.stderr.write(`Repeat ${repeat + 1}/${repeats}: ${revision}, ${count} tools\n`)
        const entry = pathToFileURL(
          join(
            temporary,
            revision === 'reference' ? 'candidate' : revision,
            packagePath,
            'src/runtime/index.ts',
          ),
        ).href
        const stdout = execFileSync(
          process.execPath,
          [
            import.meta.filename,
            '--worker',
            revision === 'reference' ? 'bare' : 'toolkit',
            String(count),
            String(repeat),
            entry,
            String(samples),
          ],
          { encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
        )
        const lines = stdout.trim().split('\n')
        assert.equal(lines.length, revision === 'reference' ? 4 : 6, 'Incomplete workloads')
        for (const line of lines) {
          const measurement = measurementSchema.parse(JSON.parse(line))
          assert.equal(measurement.durations.length, samples)
          assert.equal(measurement.count, count)
          assert.equal(measurement.repeat, repeat)
          assert.equal(measurement.implementation, revision === 'reference' ? 'bare' : 'toolkit')
          measurements.push({ revision, ...measurement })
        }
      }
    }
    cpSync(import.meta.filename, join(output, 'catalog.ts'))
    cpSync(join(root, 'pnpm-lock.yaml'), join(output, 'pnpm-lock.yaml'))
    writeFileSync(
      join(output, 'results.json'),
      `${JSON.stringify({ ...metadata, measurements }, null, 2)}\n`,
    )
    const report =
      [
        '# Catalog comparison',
        `Baseline: \`${baseline}\`  \nCandidate: \`${candidate}\``,
        `Node ${metadata.environment.node}; ${metadata.environment.platform} ${metadata.environment.arch}; ${metadata.environment.cpu}.`,
        `${samples} samples after ${warmups} warmups, ${repeats} repeats, seed ${seed}. Both revisions use the same installed dependencies.`,
        'Each cell is the median of the per-repeat percentile. Negative change means lower latency. Timings are diagnostic, not a pass/fail threshold.',
        renderTable(measurements),
        'Raw samples, environment, dependency versions and harness hashes are in results.json. The harness and lockfile are included alongside it.',
      ].join('\n\n') + '\n'
    writeFileSync(join(output, 'summary.md'), report)
    process.stdout.write(report)
    process.stderr.write(`Saved benchmark to ${output}\n`)
  } finally {
    rmSync(temporary, { recursive: true, force: true })
  }
}

async function measure() {
  const { createMcpHandler, defineMcpTool }: typeof import('../src/runtime/index.ts') =
    await import(process.argv[6])

  const implementation = process.argv[3]
  assert(implementation === 'bare' || implementation === 'toolkit')
  const count = Number(process.argv[4])
  const repeat = Number(process.argv[5])
  const samples = Number(process.argv[7])
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
}

if (import.meta.main) {
  if (process.argv[2] === '--worker') await measure()
  else await compare()
}
