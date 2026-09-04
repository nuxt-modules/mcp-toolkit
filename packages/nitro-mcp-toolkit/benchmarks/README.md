# Catalog benchmark

From the repository root, with Node 24 or later:

```sh
pnpm --filter nitro-mcp-toolkit bench:catalog > catalog.jsonl
```

Each repetition shuffles the implementation/catalog-size pairs and runs each in a fresh process. Cases cover 10, 100 and 1,000 tools, calling the last tool and reading every catalog page, in memory and over loopback HTTP. Both implementations use the same Zod schema, result and modern protocol revision. The toolkit also has a one-tool `X-MCP-Tools` subset case; bare h3-mcp has no equivalent header.

The output includes environment information, p50/p95 in milliseconds and the number of pages read. HTTP measurements include the local server adapter and response consumption, at concurrency 1. The benchmark asserts results and total catalog size before accepting timings. It does not measure OAuth, deployment cold starts, legacy transport or competitor frameworks.

`BENCH_SAMPLES` defaults to 100 measured operations after 20 warmups; `BENCH_REPEATS` defaults to 3. `BENCH_TOOLKIT_ENTRY` accepts an absolute file URL to another checkout's runtime entry for before/after comparisons. Keep Node and dependencies identical across checkouts. Timing thresholds are deliberately not part of the test suite.

## Tool selection measurement

On Apple M4 Pro, macOS arm64, Node 24.19.0, h3-mcp 0.2.0 and Zod 4.4.3, three repetitions with 50 samples each gave these medians of the per-repetition p50 values. The baseline was commit `fcf90d9`; the change indexes tool names and positions at handler construction.

| 1,000-tool workload                   |  Baseline | Indexed selection |
| ------------------------------------- | --------: | ----------------: |
| In-memory call with a one-tool subset | 0.0657 ms |         0.0294 ms |
| In-memory unfiltered call             | 0.1381 ms |         0.1439 ms |
| HTTP call with a one-tool subset      | 1.7917 ms |         1.7194 ms |
| HTTP unfiltered call                  | 1.6823 ms |         1.6536 ms |

This demonstrates the subset optimization; unfiltered dispatch is effectively unchanged. Full enumeration still requires 20 pages for 1,000 tools. h3-mcp recreates lazy-array resolvers when the toolkit supplies per-request options, so reducing unfiltered catalog overhead requires an engine-level change that preserves request-specific plugin behavior. Do not cache engine instances by arbitrary client headers or authenticated identities.
