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
│   └── mcp-starter/        # Minimal MCP template (`pnpm dev:starter`)
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
| `pnpm dev:starter` | Start the minimal MCP starter app |
| `pnpm dev:docs` | Start the documentation site |
| `pnpm build` | Build all packages |
| `pnpm build:module` | Build only the module |
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
