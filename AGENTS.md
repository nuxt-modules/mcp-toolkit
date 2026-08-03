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

**Discovery generates two Nitro virtual modules per instance** — `#mcp/<slug>/registry`, which imports each definition file, and `#mcp/<slug>/handler`, which is what `options.handlers` mounts. Three things about this were established empirically and are easy to break:

- A bare `nitro-mcp-toolkit` import inside a virtual module resolves fine, in dev and in a production build, so the generated handler imports the toolkit exactly as a user's file does — one module instance, one `AsyncLocalStorage`.
- The registry inlines its own `fromFile` helper rather than importing one, which keeps build-time naming out of the runtime bundle and the runtime free of an export that only generated code would call.
- A route may import `#mcp/<slug>/handler` to read `handler.definitions`, and that id is typed with nothing to configure: `src/runtime/virtual.d.ts` declares the pattern `#mcp/*/handler`, and the app pulls it in through its own import of the toolkit. Three constraints hold it together, all established by experiment. The declaration must be a **global** file — the same lines inside a `.d.ts` that has a top-level export are read as an augmentation of a module that does not exist, and silently do nothing. The **dts pass drops triple-slash references**, so `build.config.ts` re-attaches the one in `src/runtime/index.ts` and ships the declaration next to the built types, rewriting its inline import from `./index.ts` to `./index.mjs`; do not point that import at the package's own name, since `typecheck` does not depend on a build and would then fail on a fresh clone. Nitro's own answer, a `paths` entry in a generated `tsconfig.json`, is not usable here: `generateTsConfig` is off by default, so it would leave every bare Nitro app mapping the id by hand.
- **Dev pickup needs `nitro.hooks.callHook('rollup:reload')`.** A new file is imported by nothing, so neither the bundler's graph nor `devServer.watch` (which reloads the worker without rebuilding) can notice it; only a rebuild re-renders the registry. The module therefore watches the definitions directory itself with `fs.watch` and calls that hook. Note the vite builder does not listen to it — an upstream gap, not something to work around here.

## Releasing

Both published packages go through the same flow: add a changeset, merge, and the `release` workflow opens a "Version Packages" PR; merging that PR publishes to npm under the `latest` dist-tag and creates a GitHub Release per package. `nitro-mcp-toolkit` used to release from a separate manual `release-alpha` workflow under an `alpha` tag while it was pre-alpha; it has since graduated onto this single track. It still stays pre-1.0 (`0.x`), so a breaking change there is a `minor` changeset, not `major` — the conventional reading of semver below 1.0.

**The two packages publish from two different npm accounts, which one bearer token can't authenticate.** `@nuxtjs/mcp-toolkit` is scoped to the Nuxt org and uses `NPM_TOKEN`; `nitro-mcp-toolkit` is unscoped and owned by a personal account, so that same token gets a 404 on it — npm's way of saying "not authorized". It publishes with `NPM_TOKEN_ALPHA` instead, a granular token scoped to that one package (the name is a holdover from the old alpha-only workflow, not a claim about the release channel). `changeset publish` publishes every package needing a release in one command, shelling out to `pnpm publish` per package with no way to pass it a different token per call — so the split happens one level down, in pnpm's own auth resolution: the `release` workflow writes a registry-wide `_authToken` (falls through to unscoped packages, i.e. `nitro-mcp-toolkit`) plus a `@nuxtjs`-scoped override in `~/.npmrc` before publishing, rather than relying on `setup-node`'s single-token `registry-url` input. Do not add a third package under a third npm account without re-checking this — pnpm's scope-based auth only branches on the `@scope` prefix, so a second unscoped package would collide with `nitro-mcp-toolkit` on the same fallback key.

`prepack` runs `obuild` in both packages, so a stale `dist` can never be published, which matters because `dev:prepare` leaves stubs there.

### MCP Starter (`apps/mcp-starter/`)

A minimal Nuxt app with one tool, one resource, and one prompt (explicit `@nuxtjs/mcp-toolkit/server` imports). Readers scaffold **only** this folder via giget/tiged (see [apps/mcp-starter/README.md](apps/mcp-starter/README.md)). Short blog paste: [PROMPT.md](apps/mcp-starter/PROMPT.md). In the monorepo, run **`pnpm build:module`** before `pnpm dev:starter` so `server` exports exist.

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

### Platform support (`nitro-mcp-toolkit`)

The runtime imports exactly one Node built-in, `node:async_hooks`, for the `AsyncLocalStorage` that carries the request context; the SDK, h3 and zod add none, so a built bundle is otherwise web-standard. Keep it that way: a second built-in would cost the edge story.

`AsyncLocalStorage` cannot be swapped for a `WeakMap` keyed by the request — the SDK does not hand back the same `Request` object it was given, which was measured, not assumed. Cloudflare therefore needs `nodejs_compat`; that is documented in the README rather than worked around.

Windows is covered by a dedicated `test-windows` CI job that runs this package's suite alone, since it is the only one whose behaviour depends on the OS. Its e2e test builds a real Nitro app, which is what proves the absolute paths in the generated registry resolve there.

**The SDK does no `Origin` validation of its own, so `createMcpHandler` adds one** (`src/runtime/origin.ts`), checked ahead of `sdk.fetch` in both `handle` and `fetch`. The default accepts a page the app serves to itself on a loopback host and refuses every other origin; requests with no `Origin` — every MCP client proper — are unaffected. The loopback condition is not decoration: `event.url` reads the `Host` header, so a bare same-origin comparison is satisfied by DNS rebinding, where the attacker's own hostname lands in both `Host` and `Origin`. Do not drop it to "simplify" the check. `allow` adds explicit origins on top of the default; a user's own `allow` list does not cost the loopback case.

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

The module includes a built-in inspector in Nuxt DevTools for debugging MCP definitions. Access it via the DevTools panel when running in development mode.

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
