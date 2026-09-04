# Catalog benchmarks

Compare two committed revisions from the repository root, using Node 24+ and installed workspace dependencies:

```sh
pnpm install --frozen-lockfile
pnpm bench:nitro <baseline-ref> [candidate-ref]
```

The candidate defaults to `HEAD`. Uncommitted runtime changes are not measured: commit them locally first. Both refs must contain `packages/nitro-mcp-toolkit/src/runtime/index.ts` and support the APIs used by the harness.

For example, compare the last commit with its parent:

```sh
pnpm bench:nitro HEAD^ HEAD --samples 100 --repeats 3 --seed 42
```

The runner extracts both revisions into temporary directories, runs the same current harness against each, and removes the directories afterward. It never switches branches or alters your checkout. Git and `tar` must be on `PATH`.

## Results and history

Every run creates a directory under `benchmarks/results/`, ignored by Git. Use `--output /absolute/path/to/new-directory` to choose another destination. Existing directories are refused so a run cannot overwrite earlier evidence.

Each completed run saves:

- `summary.md`: baseline/candidate p50 and p95, relative p50 changes and bare h3-mcp reference timings.
- `results.json`: every measured duration, workload and repetition; full commit IDs; Node, OS and CPU information; dependency versions; lockfile and harness hashes; sample counts and seed.
- The harness files and `pnpm-lock.yaml` used for the run.

Commit the harness and methodology, rather than machine-specific timing tables. The **Nitro benchmarks** workflow runs on relevant pull requests and pushes to `main`, and can also compare refs through manual dispatch. It puts the table in the job summary and retains the raw results and harness as an artifact for 90 days. Download an artifact for longer-term retention. No timing threshold gates a merge; failed requests or malformed results fail the run.

To repeat an archived run, use its harness revision (or saved harness files in this directory), restore its saved lockfile in an isolated checkout, install with `--frozen-lockfile`, and pass the recorded baseline, candidate, samples, repeats and seed. Match Node and hardware when comparing timings across runs. The hash of each harness file lets you verify an exact match even for a local harness edit.

## Methodology

Cases cover 10, 100 and 1,000 tools, calling the last tool and reading **every** catalog page, in memory and over loopback HTTP. Both implementations use the same Zod input schema, result and modern protocol revision. The toolkit also has a one-tool `X-MCP-Tools` subset case; bare h3-mcp has no equivalent header.

Each repetition shuffles baseline, candidate and reference/catalog-size pairs with a recorded seed. Every pair runs in a fresh subprocess. Workloads have 20 warmups followed by 100 measured operations by default; three repetitions are the default. HTTP includes the local server adapter and response consumption, at concurrency 1. The harness asserts status, returned tool data and complete catalog counts, and rejects repeated pagination cursors.

Percentiles use the sorted sample at `floor(sampleCount × percentile)`, capped to the last index. The report takes the median of each repetition's percentile rather than pooling samples. Negative p50 changes mean lower latency. Individual timings vary with machine load, JIT and networking; use repeated runs on an idle machine to investigate a regression.

Both revisions resolve against the **same currently installed dependencies**. This isolates toolkit source changes; it does not measure dependency upgrades, historical lockfiles or published bundles. The manifest versions and lockfile recorded in the artifact identify that shared environment. Run a frozen install before benchmarking so the lockfile describes your dependencies.

The benchmark does not measure OAuth, legacy transport, throughput under concurrent load, deployment cold starts, bundle size or competitor frameworks. Those require separate workloads before making claims about them.
