# Catalog benchmarks

The benchmark uses the installed Vitest 4 runner and Tinybench for warmup, timing, statistics and comparisons. All workload and revision orchestration code lives in `catalog.bench.ts`; there is no custom statistics engine.

From the repository root, with Node 24+ and Git and `tar` on `PATH`:

```sh
pnpm install --frozen-lockfile
pnpm bench:nitro <baseline-ref> [candidate-ref]
```

The candidate defaults to `HEAD`. Both revisions must contain `packages/nitro-mcp-toolkit/src/runtime/index.ts` and support the APIs exercised by the benchmark. Commit runtime changes locally before measuring them; the command extracts committed snapshots without switching branches or changing the checkout.

```sh
pnpm bench:nitro HEAD^ HEAD --time 1000 --repeats 3
# Measure variation with identical source on both sides:
pnpm bench:nitro HEAD HEAD --time 1000 --repeats 3
```

`--time` is the minimum measurement time in milliseconds per benchmark, alongside a minimum of 100 iterations. Warmup runs for at least 500 ms and 20 iterations. Each repeat runs baseline and candidate in fresh Vitest processes, alternating their order. Candidate runs use Vitest's `--compare` against the most recently completed baseline. The default is three repeats; individual reports stay separate rather than being combined by custom aggregation code.

## Workloads

Cases cover 10, 100 and 1,000 tools, calling the last tool and reading **every** catalog page, in memory and over loopback HTTP. Each workload compares the toolkit with bare h3-mcp using equivalent Zod schemas and results on the same modern protocol revision. The one-tool `X-MCP-Tools` subset case applies only to the toolkit.

Fixtures are prepared before measurement and closed afterward. HTTP includes the local server adapter and response consumption, at concurrency 1. Every measured invocation checks HTTP status, tool results or the complete catalog count; repeated pagination cursors and failed responses fail the benchmark. Unit tests cover these assertions.

Both revisions use the same current harness, Vitest configuration and installed dependencies. This isolates toolkit source changes; it does not compare dependency upgrades or published bundles. Vitest transforms imported source, so use runs from the same harness to compare revisions. Earlier results from the custom Node runner are a different measurement setup.

## Results and history

Every run creates an ignored directory under `benchmarks/results/`. Use `--output /absolute/path/to/new-directory` to choose another destination. Existing directories are refused.

The artifact contains:

- `baseline-N.json` and `candidate-N.json`: native Vitest results, including throughput, mean, median, percentiles, relative margin of error and sample counts. Vitest 4's JSON reporter omits individual samples.
- Matching `.txt` files: Vitest's tables and saved-baseline comparisons.
- `summary.md`: the complete reports for each repeat, used as the CI job summary.
- `metadata.json`: commit IDs, environment, dependency versions, measurement settings and hashes.
- The benchmark file, Vitest config and lockfile used for the run.

The **Nitro benchmarks** workflow runs on relevant pull requests and pushes to `main`, and supports manual comparisons. It retains artifacts for 90 days; download them for longer retention. No latency threshold gates a merge. Inspect Vitest's error estimates, repeat variation and a same-commit control before treating small differences as regressions. The relative margin of error describes variation within that run, not differences between machines or separate processes.

To reproduce a run, check out its harness revision or restore the archived benchmark file and config to their original locations in an isolated checkout. Restore the saved lockfile, install with `--frozen-lockfile`, and use the recorded baseline, candidate, time and repeats on matching Node and hardware.

OAuth, legacy transport, concurrent load, deployment cold starts, bundle size and competitor frameworks require separate workloads. These catalog measurements do not establish performance for those cases.
