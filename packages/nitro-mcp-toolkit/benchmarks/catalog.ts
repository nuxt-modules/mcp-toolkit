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
import { measurementSchema, renderTable, type Measurement } from './report.ts'

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
const harnessFiles = ['catalog.ts', 'worker.ts', 'report.ts']
const metadata = {
  formatVersion: 1,
  startedAt,
  baseline,
  candidate,
  harnessRevision: git('rev-parse', 'HEAD'),
  harnessHashes: Object.fromEntries(
    harnessFiles.map((file) => [file, hash(readFileSync(join(benchmarkDir, file)))]),
  ),
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
  warmups: 20,
  repeats,
  seed,
  units: 'milliseconds',
  protocol: '2026-07-28',
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
        (['baseline', 'candidate', 'reference'] as const).map((revision) => ({ revision, count })),
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
          join(benchmarkDir, 'worker.ts'),
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
  for (const file of harnessFiles) cpSync(join(benchmarkDir, file), join(output, file))
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
      `${samples} samples after 20 warmups, ${repeats} repeats, seed ${seed}. Both revisions use the same installed dependencies.`,
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
