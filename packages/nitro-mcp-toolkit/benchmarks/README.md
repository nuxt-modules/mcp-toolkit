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

Cases cover 10, 100 and 1,000 tools, calling the last tool and reading **every** catalog page, in memory and over loopback HTTP. Each workload compares the toolkit with bare h3-mcp using equivalent Zod schemas and results on the same modern protocol revision. The `subset` case selects one tool; `selection` selects the last 10% of tools in reverse order. These two cases apply only to the toolkit and repeat the same `X-MCP-Tools` header, measuring steady-state selection reuse. They do not measure workloads that change the allowlist every request.

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

OAuth, legacy transport, concurrent load, deployment cold starts and competitor frameworks require separate workloads. These catalog measurements do not establish performance for those cases.

## Built consumers and HTTP profiles

```sh
pnpm bench:consumer HEAD --repeats 5 --profile
```

`consumer.ts` extracts the requested commit (default `HEAD`), builds its package with obuild, and imports the built public exports in five isolated Nitro consumers: one tool, OAuth with an opaque-token verifier, directory discovery, 1,000 tools, and bare h3-mcp with 1,000 tools. All use the currently installed dependencies and the same production Nitro configuration (`standard`, Rolldown, minification, no external packages). No new dependencies are installed. This exercises built output and consumer tree shaking; ordinary npm installation and packed declarations remain covered by `pnpm test:package`.

`--output /new/directory` selects an artifact directory; the default is under `benchmarks/results/`. Reports include every emitted JavaScript file's byte and gzip size, the bundler's module contributions, and every startup sample. Module `renderedLength` is a bundler diagnostic, not a post-minification byte attribution. Total gzip size sums separately compressed files; source maps and non-JavaScript assets are excluded. Minimal and discovery builds fail if they retain rendered `jose` modules.

Each startup sample launches a fresh Node process. `importMs` measures importing the Nitro entry, `firstRequestMs` measures the first successful in-memory tool call including lazy route imports, and `processToReadyMs` includes process launch, worker initialization, that call and opening the loopback listener. Filesystem caches stay warm. These timings are raw observations, not deployment cold-start estimates. OAuth verifies a fixed benchmark token locally; it does not measure JWT verification or JWKS fetching.

`--profile` records the server process only, including the small Node HTTP adapter, after 200 warmup requests and for 3,000 sequential HTTP calls. The toolkit profile selects 100 of 1,000 tools; the bare-engine profile calls a tool without filtering. They diagnose different paths and are not a speed comparison. Open each `http.cpuprofile` in a CPU-profile viewer; corresponding built files are retained under the scenario's `server/` directory. The profile contains original temporary source URLs, which can be matched by their relative server paths.

The artifact also saves the source archive, generated fixtures, harness files and hashes, dependency versions, lockfile and build settings. Run baseline and candidate on the same machine with the same harness and dependencies; use the catalog Vitest command for timing comparisons. Consumer CI reports sizes and preserves startup samples without enforcing a timing threshold.
