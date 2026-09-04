import assert from 'node:assert/strict'
import { z } from 'zod'

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
