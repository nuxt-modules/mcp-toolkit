# AGENTS.md

A guide for AI coding agents working on the Nuxt MCP Toolkit project.

## Project Overview

**Nuxt MCP Toolkit** is a Nuxt module that enables developers to create [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers directly in their Nuxt applications. It provides automatic discovery of tools, resources, and prompts with zero configuration - just create files and they're automatically registered.

### Monorepo Structure

This is a pnpm monorepo managed with Turborepo:

```
nuxt-mcp-toolkit/
├── packages/
│   └── nuxt-mcp-toolkit/     # Main module (published as @nuxtjs/mcp-toolkit)
├── apps/
│   ├── docs/                 # Documentation site (mcp-toolkit.nuxt.dev)
│   ├── playground/           # Development playground for testing
│   ├── mcp-starter/        # Minimal MCP template (`pnpm dev:starter`)
│   └── nitro-playground/   # Bare Nitro v3 app for nitro-mcp-toolkit (`pnpm dev:nitro`)
```

## Development Environment Setup

### Prerequisites

- Node.js 18+
- pnpm 9.15.0+

### Initial Setup

```bash
# Install dependencies
pnpm install

# Generate type stubs (required before first run)
pnpm run dev:prepare

# Start the playground
pnpm run dev

# Start the docs site
pnpm run dev:docs

# Start the minimal MCP starter
pnpm run dev:starter
```

## Common Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the playground app |
| `pnpm dev:nitro` | Start the Nitro playground and its inspector UI on port 3030 |
| `pnpm probe:nitro` | Drive the Nitro playground with a real MCP client, from the CLI |
| `pnpm dev:starter` | Start the minimal MCP starter app |
| `pnpm dev:docs` | Start the documentation site |
| `pnpm build` | Build all packages |
| `pnpm build:module` | Build only the module |
| `pnpm build:nitro` | Build only the Nitro toolkit |
| `pnpm build:docs` | Build only the docs |
| `pnpm test` | Run all tests |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm eval` | Run MCP evals (docs) |
| `pnpm eval:ui` | Run MCP evals with UI (docs) |

## Project Structure

### Main Module (`packages/nuxt-mcp-toolkit/`)

```
packages/nuxt-mcp-toolkit/
├── src/
│   ├── module.ts                    # Main module entry point
│   └── runtime/
│       ├── components/              # Vue components (InstallButton)
│       └── server/
│           ├── mcp/
│           │   ├── definitions/     # Tool, resource, prompt definitions
│           │   ├── loaders/         # File discovery and loading
│           │   ├── validators/      # Zod validation logic
│           │   ├── handler.ts       # MCP HTTP handler
│           │   └── utils.ts         # Utility functions
│           └── types/               # TypeScript types
└── test/
    ├── *.test.ts                    # Test files
    ├── fixtures/                    # Test fixtures (mini Nuxt apps)
    └── helpers/                     # Test utilities
```

### Documentation (`apps/docs/`)

Built with Nuxt Content. MCP definitions are in `server/mcp/`:

```
apps/docs/server/mcp/
├── tools/           # MCP tools (list-pages, get-page)
├── prompts/         # MCP prompts (create-tool, troubleshoot, etc.)
└── resources/       # MCP resources
```

### Playground (`apps/playground/`)

A full-featured example app demonstrating module usage with authentication, todos, and various MCP definitions.

### Nitro Playground (`apps/nitro-playground/`)

A bare Nitro v3 app used to exercise `nitro-mcp-toolkit`. `pnpm dev:nitro` serves an **inspector** on port 3030 that lists every definition, generates a form from its advertised schema, renders the result, and exposes the raw JSON-RPC — use it in preference to `pnpm probe:nitro`, which is the same thing as a CLI. The inspector (`apps/nitro-playground/public/inspector.js`) speaks MCP directly over `fetch` rather than through the SDK, so it stays dependency-free and fails whenever the HTTP surface regresses; it is the seed of the Wave 6 dev inspector. It depends on the toolkit as a plain `workspace:*` dependency and imports it by its public specifier, with **no alias**, so it validates the same resolution a user gets — a broken `exports` map fails here. Source-level reloading comes from two pieces instead: `dev:prepare` runs `obuild --stub`, which points the toolkit's `dist` at its source, and the app's `devServer.watch` reloads when that source changes. Because `dev:prepare` leaves stubs in `dist`, run `pnpm build:nitro` for a real artifact before publishing or measuring bundle size.

Relative imports inside `packages/nitro-mcp-toolkit/src` must carry their `.ts` extension — that is what makes the source loadable by Node, and therefore what makes the stub work.

The app installs `mcp()` from `nitro-mcp-toolkit/module` twice, on `/mcp` and `/admin/mcp`, so both discovery and the multi-server case stay exercised by hand. Nothing collects definitions: dropping a file under `server/mcp/{tools,resources,prompts}` is the whole wiring, and its filename is its name. The package's own e2e fixture passes the `mcp()` instances to `createNitro` instead of declaring them in a `nitro.config.ts` — Nitro's config loader would otherwise transform `src/module` a second time, which wrecks coverage attribution. The playground is what proves a real `nitro.config.ts` can import the module by its public specifier.

**Definitions belong to whichever `mcp()` scans their directory, and to nothing else.** Each instance globs its own `dir` and generates its own registry, so `/mcp` does not filter the admin definitions out — they were never in it. The Nuxt module works the opposite way, with one global pool, `_meta.handler` attribution and `orphansOnly` filtering per endpoint; none of that has an equivalent here, and it should not grow one. What the directory model can hide instead is a definition no instance scans, which is why every build reports what each endpoint serves (`src/module/report.ts`), and why the report warns about an empty `dir` or a near-miss directory name. The runtime side of the same set is `handler.definitions`, JSON-serializable and filtered with `Array.filter` rather than a query API.

**Discovery generates two Nitro virtual modules per instance** — `#mcp/<slug>/registry`, which imports each definition file, and `#mcp/<slug>/handler`, which is what `options.handlers` mounts. Apps never import those ids: every instance is re-exported from a third virtual, `nitro-mcp-toolkit/servers` (`mcp` for `/mcp`, `adminMcp` for `/admin/mcp`). These were established empirically and are easy to break:

- A bare `nitro-mcp-toolkit` import inside a virtual module resolves fine, in dev and in a production build, so the generated handler imports the toolkit exactly as a user's file does — one module instance.
- The registry inlines its own `fromFile` helper rather than importing one, which keeps build-time naming out of the runtime bundle and the runtime free of an export that only generated code would call.
- `nitro-mcp-toolkit/servers` is itself a virtual (the barrel that re-exports every `#mcp/<slug>/handler`). Do not alias it to another virtual: Rolldown's `resolve.alias` does not call other plugins' `resolveId`, so the replacement is never loaded. The published stub types `mcp`; extra names are written to `node_modules/.nitro/types/mcp-servers.d.ts` and referenced from Nitro's `nitro.d.ts`. A route may still `import mcp from '#mcp/mcp/handler'` — `src/runtime/virtual.d.ts` declares the pattern `#mcp/*/handler`. That declaration must stay a **global** file — the same lines inside a `.d.ts` that has a top-level export are read as an augmentation of a module that does not exist, and silently do nothing. The **dts pass drops triple-slash references**, so `build.config.ts` re-attaches the one in `src/runtime/index.ts` and ships the declaration next to the built types, rewriting its inline import from `./index.ts` to `./index.mjs`; do not point that import at the package's own name, since `typecheck` does not depend on a build and would then fail on a fresh clone.
- **Dev pickup needs `nitro.hooks.callHook('rollup:reload')`.** A new file is imported by nothing, so neither the bundler's graph nor `devServer.watch` (which reloads the worker without rebuilding) can notice it; only a rebuild re-renders the registry. The module therefore watches the definitions directory itself with `fs.watch` and calls that hook. Note the vite builder does not listen to it — an upstream gap, not something to work around here.

## Releasing

Both published packages go through the same flow: add a changeset, merge, and the `release` workflow opens a "Version Packages" PR; merging that PR publishes to npm under the `latest` dist-tag and creates a GitHub Release per package. `nitro-mcp-toolkit` used to release from a separate manual `release-alpha` workflow under an `alpha` tag while it was pre-alpha; it has since graduated onto this single track. It still stays pre-1.0 (`0.x`), so a breaking change there is a `minor` changeset, not `major` — the conventional reading of semver below 1.0.

**The two packages publish from two different npm accounts, which one bearer token can't authenticate.** `@nuxtjs/mcp-toolkit` is scoped to the Nuxt org and uses `NPM_TOKEN`; `nitro-mcp-toolkit` is unscoped and owned by a personal account, so that same token gets a 404 on it — npm's way of saying "not authorized". It publishes with `NPM_TOKEN_ALPHA` instead, a granular token scoped to that one package (the name is a holdover from the old alpha-only workflow, not a claim about the release channel). `changeset publish` publishes every package needing a release in one command, shelling out to `pnpm publish` per package with no way to pass it a different token per call — so the split happens one level down, in pnpm's own auth resolution: the `release` workflow writes a registry-wide `_authToken` (falls through to unscoped packages, i.e. `nitro-mcp-toolkit`) plus a `@nuxtjs`-scoped override in `~/.npmrc` before publishing, rather than relying on `setup-node`'s single-token `registry-url` input. Do not add a third package under a third npm account without re-checking this — pnpm's scope-based auth only branches on the `@scope` prefix, so a second unscoped package would collide with `nitro-mcp-toolkit` on the same fallback key.

`prepack` runs `obuild` in both packages, so a stale `dist` can never be published, which matters because `dev:prepare` leaves stubs there.

### MCP Starter (`apps/mcp-starter/`)

A minimal Nuxt app with one tool, one resource, and one prompt (explicit `@nuxtjs/mcp-toolkit/server` imports). Readers scaffold **only** this folder via giget/tiged (see [apps/mcp-starter/README.md](apps/mcp-starter/README.md)). Short blog paste: [PROMPT.md](apps/mcp-starter/PROMPT.md). In the monorepo, run **`pnpm build:module`** before `pnpm dev:starter` so `server` exports exist.

## Changesets

**Every user-facing change to a published package needs a changeset.** Before opening a PR that touches `packages/nuxt-mcp-toolkit` or `packages/nitro-mcp-toolkit`, run `pnpm changeset` and commit the generated `.changeset/*.md` file alongside the code.

- **When to add one:** any change that affects the public API, adds a feature, fixes a bug, or introduces a breaking change in either package.
- **When you can skip:** changes confined to `apps/*` (docs, playground, mcp-starter, nitro-playground) or repo tooling (CI config, lint config, test refactors) that don't touch a published package.
- **Bump type:** `patch` for fixes, `minor` for features. Both packages are pre-1.0 (`0.x`), so a breaking change is also `minor`, not `major` — the conventional reading of semver below 1.0 (see [Releasing](#releasing)).
- **Description:** write from the consumer's perspective — what changed and how to use it. Look at existing files in `.changeset/` for tone and depth.

A PR without a changeset for a user-facing change should not be merged. For the rare change that genuinely needs no release note, run `pnpm changeset add --empty`.

## Commits & PR Titles

PR titles and commits follow [Conventional Commits](https://conventionalcommits.org). The CI source of truth is `.github/workflows/semantic-pull-request.yml` (lints PR titles via `amannn/action-semantic-pull-request`); `.github/pull_request_template.md` mirrors the same lists for contributors.

- **Subject must not start with an uppercase letter.** `feat: add stream server` ✓ — `feat: Add stream server` ✗.
- **Current scopes:** `deps`, `docs`, `module`, `nitro`, `playground`. Use `module` for `@nuxtjs/mcp-toolkit` changes and `nitro` for `nitro-mcp-toolkit` changes; omit the scope for cross-cutting changes (CI, root tooling, anything touching both packages).
- **When you add a new scope**, add it to **both** `.github/workflows/semantic-pull-request.yml` and `.github/pull_request_template.md`, in alphabetical order. Title validation reads the base branch's scope list, so a scope introduced in the same PR that uses it won't validate — register it in a preceding PR, or omit the scope on the introducing PR.

## Code Style and Conventions

### General

- **TypeScript** is required for all code
- **ESLint** with `@nuxt/eslint-config` (stylistic rules enabled)
- **Zod** for schema validation (use `z` from `zod`)
- Run `pnpm lint:fix` before committing
- **No type workarounds.** Never use `as unknown as X`, `@ts-ignore`/`@ts-expect-error`, or `any` to silence a type error. If a type genuinely can't be named (e.g. an unexported upstream type), restructure the code so it isn't needed — plain functions/objects over library helpers when the helper's return type isn't portable, explicit local types, or an issue upstream. Ask before reaching for a cast.
- **Comments are the exception, not the default.** Don't add comments that restate what the code does, header/banner comments on every function, or long comment blocks explaining a workaround — instead avoid needing the workaround. Only comment genuinely non-obvious rationale ("why", not "what"), and keep it to one or two lines.
- **Match the ecosystem a package sits on.** `packages/nuxt-mcp-toolkit`, `apps/docs`, and `apps/playground` stay on Nuxt-ecosystem tooling (`nuxt-module-build`, ESLint + `@nuxt/eslint-config`), since that's what their users/contributors expect. `packages/nitro-mcp-toolkit` sits directly on `nitro`/`h3` with no Nuxt in between, so it uses that ecosystem's own tooling instead: `obuild` for building and `oxlint` + `oxfmt` for linting/formatting (config in `.oxlintrc.json` / `.oxfmtrc.json`). Don't mix conventions within a single package, but different packages can follow different ecosystems when that's genuinely what they're built on.
- **Reuse what's already a dependency.** Before adding a bespoke hook/event system, cache layer, router, etc., check whether a package already in the dependency tree (e.g. `hookable`, `ohash`, `rou3` via `nitro`/`h3`) covers the need — it's free to use and matches the ecosystem's own conventions.
- **Paths in `packages/nitro-mcp-toolkit` go through `pathe`, never `node:path`.** Every path the module handles ends up in generated code, in a log line, or compared against a `tinyglobby` result — and glob results use `/` on Windows too. `pathe` normalizes everything to `/`, drive letters included, so the module produces the same strings on all three platforms and its tests can assert them. The runtime (`src/runtime`) touches no paths at all.

  **One exception, and it is not optional: `fs.watch` must be given the platform's own separators.** libuv compares the paths it reports against the one it was told to watch, and on a mismatch it calls `abort()` — the process dies on a native assertion (`!_wcsnicmp(filename, dir, dirlen)`, `src\win\fs-event.c`) that no `try` can catch. `watch.ts` therefore passes `node:path`'s `normalize` at that single call site and keeps `pathe` for everything it compares. The same assertion fires on an 8.3 short path, which is why tests take the `realpath` of their `mkdtemp` directory.

### Code style — no slop

- **No gratuitous defensive code.** Don't add try/catch, null checks, or input validation the surrounding file doesn't have — especially on paths already validated upstream (e.g. Zod-validated tool/resource/prompt input). Match the file's level of paranoia.
- **No silent fallbacks.** No empty `catch`, no `?? default` that masks a bug. If something can fail, let it fail loudly or handle it explicitly.
- **No speculative code.** No unrequested options or parameters, no "just in case" branches, no keeping an old code path alongside a new one. Delete dead code.
- **Prefer deleting and simplifying over working around.** If a fix needs a workaround, question the design before adding the workaround.
- **This extends to prose too**: test names, error messages, changeset descriptions, PR bodies. Factual and plain — no emoji, no superlatives, no filler.

### Platform support (`nitro-mcp-toolkit`)

The runtime imports no Node built-ins: h3-mcp owns the protocol, and the toolkit is otherwise web-standard. Keep it that way — a Node built-in would cost the edge story, including Cloudflare without `nodejs_compat`.

Windows is covered by a dedicated `test-windows` CI job that runs this package's suite alone, since it is the only one whose behaviour depends on the OS. Its e2e test builds a real Nitro app, which is what proves the absolute paths in the generated registry resolve there.

**h3-mcp owns origin allow-listing; the toolkit supplies the loopback default** via `origin.validate`. The default accepts a page the app serves to itself on a loopback host and refuses every other origin; requests with no `Origin` — every MCP client proper — are unaffected. The loopback condition is not decoration: `event.url` reads the `Host` header, so a bare same-origin comparison is satisfied by DNS rebinding, where the attacker's own hostname lands in both `Host` and `Origin`. Do not drop it to "simplify" the check. `allow` adds explicit origins on top of the default; a user's own `allow` list does not cost the loopback case.

The runtime is written against a pinned `h3-mcp` (currently 0.2.0). That release dropped the `Mcp` prefix on types, owns MRTR helpers and RFC 9728 `resourceMetadataUrl`, and requires URI templates to pass through `defineResourceTemplate` so RFC 6570 matching is in the bundle — `defineMcpResource` already does that. Re-export the engine's elicitation kit (`inputRequired`, `mcpElicit`, `mcpElicitUrl`, `getElicitedContent`, `getInputResponses`, `getMissingInputs`, `canRequestInput`, `getSupportedInputs`, `defineRequestState`) and `McpJsonRpcError`; do not reimplement them. `createMcpHandler`'s second argument is h3-mcp's `{ extensionPlugins }`. `nitro` is an optional peer — only `nitro-mcp-toolkit/module` imports it.

**`X-MCP-Tools` is the same kind of gate** (`src/runtime/tools-header.ts`): allowlist of tool names, HTTP 400 on unknowns, applied before the engine runs. `handler.definitions` stays the full catalog.

**`scopes` on a definition gates the call, never the listing, and that is a constraint rather than a choice.** `requireScopes` (`src/runtime/scopes.ts`) wraps the handler each of the three `build()` methods pushes, reads `event.context.oauth`, and throws `McpJsonRpcError(-32003, …, { status: 403 })`; `settle()` relays that without turning it into an `isError` result. That `status` only reaches the wire on the modern revision — a legacy request gets the same JSON-RPC error inside a `200` stream, as it does for every error — so assert on the code, not the status, unless the test pins an era. It fails closed — scopes on an endpoint with no OAuth refuse every call. Filtering `tools/list` instead is not available: h3-mcp resolves the handler's options (where the `X-MCP-Tools` filter lives) **before** `checkAuth` populates `event.context.oauth`, and that resolution is synchronous, so no JWT check fits there. The `decorate` plugin hook does run after auth, but only from `handleModernPost`, so it would leave legacy requests ungated while `era` is `dual`. Hiding listings needs a post-auth hook covering both eras upstream in h3-mcp; do not grow a local workaround. Read scopes from `scope` (space-delimited, RFC 6749) and `scp` (string or array, Okta/Entra ID) only — `permissions` is Auth0-specific and was left out on purpose.

**Plugins reach a `mcp()` server through `<dir>/plugins.ts`, not through an option** — an `ExtensionPlugin` is a live function and `mcp()` options cross into generated code as JSON. `discoverPlugins` returns *every* match so the caller can refuse an ambiguous pair; `onePluginsFile` in `src/module/index.ts` does that where it can name the route, which also keeps the watcher's `served()` from dying on a misconfiguration. The handler virtual is `async` for the same reason the registry is: a file written after `setup` must be seen at rebuild. The file's default export goes through `defineMcpPlugins` (`src/runtime/plugins.ts`), an identity function that exists purely to typecheck it — generated code is its only importer and is not checked with the app. Keep its parameter `readonly ExtensionPlugin[]` and **not** a generic: a generic preserves each plugin's `TState` but loses excess-property checking during inference, so a misspelled hook slips through, and nothing reads state through the array anyway (`pluginState` types off the instance). Adding the convention means four places, not one — `discover.ts`, `template.ts` (`renderHandler`'s second argument), `watch.ts` (`couldChangeServed` plus `served`, or creating the file triggers no `rollup:reload`), and `report.ts`.

**OAuth** is a generic resource-server: `mcp({ oauth: { resource, authorizationServers, jwt } })` or `createMcpOAuth`. JWT verify, claims on `event.context.oauth`, RFC 9728 metadata mounted. Connectors (`nitro-mcp-toolkit/oauth/clerk`, `/okta`, `/workos`) return that same options object — Clerk infers issuer/JWKS from `CLERK_PUBLISHABLE_KEY` and skips `aud` (client is in `azp`). The package does not mint tokens. Opaque tokens still mean `createMcpOAuth({ verify })` in a route file.

### MCP Definitions

Use the helper functions:

```typescript
// Tools - server/mcp/tools/*.ts (or subdirectories like tools/admin/*.ts)
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  name: 'tool-name',           // Optional - auto-generated from filename
  group: 'admin',              // Optional - auto-inferred from subdirectory
  tags: ['destructive'],       // Optional - free-form tags for filtering
  description: 'What it does',
  inputSchema: {
    param: z.string().describe('Parameter description'),
  },
  handler: async ({ param }) => {
    return 'Result' // string, number, boolean, object, or full CallToolResult
  },
})

// Resources - server/mcp/resources/*.ts
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  name: 'resource-name',
  uri: 'file:///path/or/pattern',
  handler: async (uri: URL) => {
    return {
      contents: [{ uri: uri.toString(), text: 'Content' }],
    }
  },
})

// Prompts - server/mcp/prompts/*.ts
import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  name: 'prompt-name',
  inputSchema: {
    arg: z.string(),
  },
  handler: async ({ arg }) => {
    return {
      messages: [{
        role: 'user',
        content: { type: 'text', text: `Message with ${arg}` },
      }],
    }
  },
})
```

### Auto-Generated Names

If `name` and `title` are omitted, they are auto-generated from the filename:
- `list-documentation.ts` → name: `list-documentation`, title: `List Documentation`

### Client tool allowlist

Clients can send `X-MCP-Tools` (comma-separated names matching `tools/list`) to subset the catalog. Unknown names return HTTP 400. On `@nuxtjs/mcp-toolkit` this runs after `enabled()` and `mcp:config:resolved`. On `nitro-mcp-toolkit` it runs ahead of the engine (same place as origin/auth) and does not change `handler.definitions`.

### Return Types

- **Tools**: Return `string`, `number`, `boolean`, object, array (auto-wrapped), or full `CallToolResult`. Use `imageResult` / `audioResult` for image and audio content blocks. Thrown errors become `isError` results.
- **Resources**: Return `{ contents: [{ uri: string, text: string }] }`
- **Prompts**: Return `{ messages: [{ role: 'user' | 'assistant', content: { type: 'text', text: string } }] }`

## Testing

Tests use **Vitest** and are located in `packages/nuxt-mcp-toolkit/test/`.

```bash
# Run all tests
pnpm test

# Watch mode (from module directory)
cd packages/nuxt-mcp-toolkit
pnpm test:watch
```

### Test Structure

- `basic.test.ts` - Core functionality tests
- `tools.test.ts` - Tool definition tests
- `resources.test.ts` - Resource definition tests
- `prompts.test.ts` - Prompt definition tests
- `handler.test.ts` - HTTP handler tests
- `fixtures/` - Mini Nuxt apps used as test fixtures

### Performance in Tests

- Keep `lint`, `typecheck`, and `test` as separate package scripts (don't merge them into one command) so Turborepo can cache and run each independently.
- If a test needs an expensive fixture (building a full app, booting a server), set it up once in `beforeAll`/`afterAll` and share it across the `it()` blocks in that `describe`, rather than rebuilding per test in `beforeEach`/`afterEach`.
- Prefer a fast unit test that imports the function under test directly from `src` over an end-to-end test that goes through a full build, when the two would cover the same logic — it's faster, has accurate coverage (a full build/bundle round-trip breaks source-to-coverage mapping), and doesn't need type-unsafe mocking. Reserve full build/e2e tests for verifying wiring that unit tests can't reach.

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest'
import { setupMcpTest } from './helpers/mcp-setup'

describe('my feature', () => {
  it('should work', async () => {
    const { client } = await setupMcpTest('basic')
    const result = await client.callTool({ name: 'test-tool', arguments: {} })
    expect(result).toBeDefined()
  })
})
```

## Definition of Done

A task is complete when **all** of the following pass:

1. `pnpm lint`, `pnpm typecheck`, `pnpm test` exit 0
2. The change has a matching test (bug fix → failing regression first, then the fix)
3. New public APIs are documented (README and/or the docs site content under `apps/docs/`)
4. A changeset is included for any user-facing change to either package (`pnpm changeset`)
5. Any skill under `apps/docs/skills/` documenting the changed behavior was updated in the same PR

## Boundaries

**Always do:**
- Run lint, typecheck, and test before reporting done
- Follow existing code patterns — read neighboring files before writing new ones
- Add a changeset (`pnpm changeset`) for every user-facing change to `packages/nuxt-mcp-toolkit` or `packages/nitro-mcp-toolkit`
- Keep `AGENTS.md` and the skills under `apps/docs/skills/` in sync with the behavior they document

**Ask first:**
- Adding new dependencies
- Changing package exports (`package.json#exports`) or build config
- Architectural decisions that affect multiple packages (e.g. the definition contract shared between `nuxt-mcp-toolkit` and `nitro-mcp-toolkit`)

**Never:**
- Commit secrets, `.env` files, or API keys
- Skip tests or lint to "fix later"
- Loosen an assertion, widen a type, or delete a test to make it pass — a failing test is a signal; fix the cause
- Add a type workaround (`as unknown as X`, `@ts-ignore`/`@ts-expect-error`, `any`) to silence an error — see [No type workarounds](#general)
- Modify `node_modules/` or generated files (`.nuxt/`, `dist/`)
- Open a PR for a user-facing change without a changeset

## Git & PRs — Local Always OK, Remote on Explicit Instruction

Default: anything that stays on the local clone is fine; anything that touches the remote or GitHub requires an explicit instruction in the task at hand. Don't act on assumption — if the request didn't ask for a push or a PR, prepare the branch locally and stop there.

**OK (local-only, no ask needed):**
- `git branch`, `git checkout`, `git switch`, `git checkout -b` — create and move between branches freely
- `git add`, `git commit` — staging and local commits are fine
- `git status`, `git diff`, `git log`, `git show`, `git stash`, `git restore`, `git reset` (local only) — read and rearrange the working tree
- `gh pr view`, `gh pr list`, `gh pr diff`, `gh issue view`, `gh run view` — read-only GitHub queries

**OK when explicitly asked (in the current task):**
- `git push -u origin <feature-branch>` — push a feature branch you just prepared
- `git push --force-with-lease origin <feature-branch>` — only on a feature branch you authored, after a clean rebase
- `gh pr create --base main --head <feature-branch>` — open a PR
- Write a PR title (Conventional Commits, see above) and a factual PR body

**Never (no exceptions, even when asked):**
- Push directly to `main` — always goes through a PR
- `git push --force` without `--with-lease`, `git push --tags`
- `gh pr merge`, `gh pr close`, `gh release create` — releases are automated (see [Releasing](#releasing))

## MCP Reference Documentation

### Official MCP Resources

- **MCP Introduction**: https://modelcontextprotocol.io/docs/getting-started/intro
- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **MCP Server Guide**: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md

### Module Documentation

- **Full Documentation**: https://mcp-toolkit.nuxt.dev
- **Installation Guide**: https://mcp-toolkit.nuxt.dev/getting-started/installation
- **Tools Guide**: https://mcp-toolkit.nuxt.dev/tools/overview
- **Resources Guide**: https://mcp-toolkit.nuxt.dev/resources/overview
- **Prompts Guide**: https://mcp-toolkit.nuxt.dev/prompts/overview

### MCP Core Concepts

**Tools** are functions that AI assistants can call:
- Accept input parameters validated with Zod
- Return structured results (text, images, or embedded resources)
- Can have annotations for behavior hints

**Resources** provide access to data via URIs:
- Static resources: single URI
- Resource templates: URI patterns with placeholders
- Can return text or binary content

**Prompts** are reusable message templates:
- Accept dynamic arguments
- Return structured messages for AI assistants
- Can include multiple messages in a conversation format

### SDK Version

This module uses `@modelcontextprotocol/sdk` version 1.23.0+. When referencing SDK documentation, ensure compatibility with this version.

## Key Files

| File | Description |
|------|-------------|
| `packages/nuxt-mcp-toolkit/src/module.ts` | Main module entry point |
| `packages/nuxt-mcp-toolkit/src/runtime/server/mcp/handler.ts` | MCP HTTP handler |
| `packages/nuxt-mcp-toolkit/src/runtime/server/mcp/definitions/` | Definition processors |
| `packages/nuxt-mcp-toolkit/src/runtime/server/mcp/loaders/` | File discovery logic |
| `packages/nuxt-mcp-toolkit/src/runtime/server/types/` | TypeScript type definitions |

## Troubleshooting

### Common Issues

1. **Types not available**: Run `pnpm dev:prepare` to generate type stubs
2. **Changes not reflected**: Restart the dev server after modifying module code
3. **Test failures**: Ensure fixtures have `node_modules` (run `pnpm install` in fixture dirs if needed)

### MCP Inspector

The module includes a built-in inspector in Nuxt DevTools for debugging MCP definitions. Access it via the DevTools **MCP Inspector** tab when running in development mode; it opens in a new browser tab.

## Agent Skills

This repository includes agent skills for AI-assisted MCP server development.

### Available Skills

| Skill | Description |
|-------|-------------|
| `skills/manage-mcp` | Setup, create, review, troubleshoot, and test MCP servers in Nuxt |

### Skill Structure (in this repo)

Skills live under the documentation app and are published with the docs site:

```
apps/docs/skills/
└── manage-mcp/
    ├── SKILL.md              # Main skill instructions
    └── references/
        ├── middleware.md     # Middleware patterns & examples
        ├── tools.md          # Tool examples
        ├── resources.md      # Resource examples
        ├── prompts.md        # Prompt examples
        ├── testing.md        # Testing guide with Evalite
        └── troubleshooting.md # Troubleshooting guide
```

[Docus](https://docus.dev) serves them at `/.well-known/skills/` on the deployed docs (see [Agent Skills in Docus](https://docus.dev/en/ai/skills)).

### Using Skills

Skills follow the [Agent Skills](https://agentskills.io/) specification. Compatible agents (Cursor, Claude Code, etc.) can discover and use these skills automatically.

Install from production documentation (recommended):

```bash
npx skills add https://mcp-toolkit.nuxt.dev
```

Discovery catalog: [https://mcp-toolkit.nuxt.dev/.well-known/skills/index.json](https://mcp-toolkit.nuxt.dev/.well-known/skills/index.json)

## When Stuck

- Unsure about a design decision → read the relevant section of this file before guessing; several sections above document *why*, not just *what*
- Unclear requirements → ask a clarifying question before making large speculative changes

## Feedback & Self-Maintenance

**This file is living documentation — keep it true.** If it contradicts the repo (a command that doesn't exist, a path that moved, a described workflow that isn't real), flag it and propose the fix, even if unrelated to the current task. Update it when you encounter:
- A recurring mistake or easy-to-get-wrong pattern
- Explicit guidance from the maintainer
- A new convention that should be applied consistently

A correction is a few lines, not a rewrite — keep this file lean.
