import { describe, expect, it } from 'vitest'
import {
  measurementSchema,
  percentile,
  renderTable,
  summarize,
  type Measurement,
} from '../benchmarks/catalog.ts'

function row(revision: Measurement['revision'], repeat: number, durations: number[]): Measurement {
  return {
    revision,
    implementation: 'toolkit',
    count: 1000,
    repeat,
    transport: 'memory',
    workload: 'subset',
    pages: 1,
    durations,
  }
}

describe('benchmark reports', () => {
  it('summarizes repeats equally and reports a latency reduction as negative', () => {
    const measurements = [
      row('baseline', 0, [4, 2, 3, 1]),
      row('baseline', 1, [20, 40, 10, 30]),
      row('baseline', 2, [100, 200, 300, 400]),
      row('candidate', 0, [1, 2, 3, 4]),
      row('candidate', 1, [5, 10, 15, 20]),
      row('candidate', 2, [2, 4, 6, 8]),
    ]
    const [result] = summarize(measurements)
    expect(result).toEqual({
      workload: '1000/memory/subset',
      baseline: { p50: 30, p95: 40 },
      candidate: { p50: 6, p95: 8 },
      reference: undefined,
      changePercent: -80,
    })
    expect(renderTable(measurements)).toContain(
      '| 1000/memory/subset | 30.0000 / 40.0000 | 6.0000 / 8.0000 | -80.0% | — |',
    )
    expect(measurements[0]!.durations).toEqual([4, 2, 3, 1])
  })

  it('rejects missing comparisons and invalid samples', () => {
    expect(() => summarize([row('baseline', 0, [1])])).toThrow('Missing comparison')
    expect(() => percentile([], 0.5)).toThrow('empty measurements')
    for (const durations of [[], [NaN], [Infinity], [-1]]) {
      expect(measurementSchema.safeParse(row('baseline', 0, durations)).success).toBe(false)
    }
    expect(percentile([3], 0.95)).toBe(3)
  })
})
