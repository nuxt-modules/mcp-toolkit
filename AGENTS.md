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
│   └── playground/           # Development playground for testing
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
```

## Common Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start the playground app |
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

## Code Style and Conventions

### General

- **TypeScript** is required for all code
- **ESLint** with `@nuxt/eslint-config` (stylistic rules enabled)
- **Zod** for schema validation (use `z` from `zod`)
- Run `pnpm lint:fix` before committing

### MCP Definitions

Use the auto-imported helper functions:

```typescript
// Tools - server/mcp/tools/*.ts
export default defineMcpTool({
  name: 'tool-name',           // Optional - auto-generated from filename
  description: 'What it does',
  inputSchema: {
    param: z.string().describe('Parameter description'),
  },
  handler: async ({ param }) => {
    return {
      content: [{ type: 'text', text: 'Result' }],
    }
  },
})

// Resources - server/mcp/resources/*.ts
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

- **Tools**: Return `{ content: [{ type: 'text', text: string }] }` or structured content
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
- **Tools Guide**: https://mcp-toolkit.nuxt.dev/core-concepts/tools
- **Resources Guide**: https://mcp-toolkit.nuxt.dev/core-concepts/resources
- **Prompts Guide**: https://mcp-toolkit.nuxt.dev/core-concepts/prompts

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

### Skill Structure

```
skills/
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

### Using Skills

Skills follow the [Agent Skills](https://agentskills.io/) specification. Compatible agents (Cursor, Claude Code, etc.) can discover and use these skills automatically.

To manually install with the skills CLI:

```bash
npx skills add nuxt-modules/mcp-toolkit
```
