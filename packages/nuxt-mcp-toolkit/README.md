# Nuxt MCP Toolkit

<!-- automd:badges color="black" license name="nuxt-mcp-toolkit" -->

[![npm version](https://img.shields.io/npm/v/nuxt-mcp-toolkit?color=black)](https://npmjs.com/package/nuxt-mcp-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/nuxt-mcp-toolkit?color=black)](https://npm.chart.dev/nuxt-mcp-toolkit)
[![license](https://img.shields.io/github/license/HugoRCD/nuxt-mcp-toolkit?color=black)](https://github.com/HugoRCD/nuxt-mcp-toolkit/blob/main/LICENSE)

<!-- /automd -->

A Nuxt module to easily create a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server directly in your Nuxt application. Define MCP tools, resources, and prompts with zero configuration - just create files and they're automatically discovered and registered.

## ✨ Features

- 🎯 **Zero Configuration** - Automatic discovery of tools, resources, and prompts from your file structure
- 📦 **File-based Organization** - Organize definitions in intuitive directory structures
- 🚀 **Multiple Handlers** - Create multiple MCP endpoints in a single application
- 🔍 **Built-in Inspector** - Visual debugging tool integrated into Nuxt DevTools
- 📝 **TypeScript First** - Full type safety with auto-imports and complete type inference
- 🔒 **Zod Validation** - Built-in input/output validation with Zod schemas
- 🔧 **Flexible Architecture** - Custom paths, routes, and hooks for advanced use cases

## 🚀 Installation

Use `nuxi` to install the module automatically:

```bash
npx nuxi module add nuxt-mcp-toolkit
```

Or install manually with your package manager (don't forget `zod`!):

```bash
# npm
npm install -D nuxt-mcp-toolkit zod@^3

# yarn
yarn add -D nuxt-mcp-toolkit zod@^3

# pnpm
pnpm add -D nuxt-mcp-toolkit zod@^3

# bun
bun install -D nuxt-mcp-toolkit zod@^3
```

**Note:** This module requires Zod v3 as a peer dependency. Zod v4 is not compatible with the MCP SDK.

## 📖 Quick Start

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['nuxt-mcp-toolkit'],
  mcp: {
    name: 'My MCP Server',
    version: '1.0.0',
  },
})
```

Create your first tool in `server/mcp/tools/echo.ts`:

```typescript
import { z } from 'zod'

export default defineMcpTool({
  // name is optional - auto-generated from filename (echo.ts → 'echo')
  description: 'Echo back a message',
  inputSchema: {
    message: z.string().describe('The message to echo back'),
  },
  handler: async ({ message }) => {
    return {
      content: [{
        type: 'text',
        text: `Echo: ${message}`,
      }],
    }
  },
})
```

The tool will be automatically discovered and registered. No imports needed - all helpers are auto-imported!

## 🔍 MCP Inspector

The module includes a built-in integration with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), a visual debugging tool for testing and debugging your MCP server.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="/docs/public/mcp-devtools-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="/docs/public/mcp-devtools-light.png">
  <img alt="MCP Inspector" src="/docs/public/mcp-devtools-light.png">
</picture>

Enable DevTools in your `nuxt.config.ts`, then open Nuxt DevTools and navigate to the **MCP Inspector** tab in the **Server** section. Click **Launch Inspector** to start testing your tools, resources, and prompts with a visual interface.

The inspector automatically connects to your MCP server - no configuration needed.

## 📚 Documentation

📖 **[Full Documentation →](https://github.com/HugoRCD/nuxt-mcp-toolkit/tree/main/docs)**

The complete documentation includes:

- **Getting Started** - Installation, configuration, first steps, and MCP Inspector
- **Core Concepts** - Tools, resources, prompts, and handlers
- **Advanced Topics** - Custom paths, TypeScript, and hooks
- **Examples** - Real-world examples and common patterns

## 🔧 Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the MCP server |
| `route` | `string` | `'/mcp'` | Path for the MCP endpoint |
| `browserRedirect` | `string` | `'/'` | Redirect URL when a browser accesses the MCP endpoint |
| `name` | `string` | `''` | Name of the MCP server |
| `version` | `string` | `'1.0.0'` | Version of the MCP server |
| `dir` | `string` | `'mcp'` | Base directory for MCP definitions (relative to `server/`) |

See the [Configuration Guide](docs/content/1.getting-started/3.configuration.md) for detailed information.

## 📝 TypeScript Support

All helpers are auto-imported in your server files - no imports needed:

- `defineMcpTool` - Define tools with Zod validation and type inference
- `defineMcpResource` - Define resources with URI templates
- `defineMcpPrompt` - Define reusable prompts with optional arguments
- `defineMcpHandler` - Create custom MCP endpoints with multiple handlers

Full TypeScript support with complete type inference from your Zod schemas. Input and output types are automatically inferred. See the [TypeScript Guide](docs/content/3.advanced/3.typescript.md) for more information.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

### Local Development

```bash
# Install dependencies
pnpm install

# Generate type stubs
pnpm run dev:prepare

# Develop with playground
pnpm run dev

# Build playground
pnpm run dev:build

# Lint
pnpm run lint

# Test
pnpm run test
pnpm run test:watch

# Release
pnpm run release
```

<!-- automd:contributors author="HugoRCD" license="MIT" github="HugoRCD/nuxt-mcp-toolkit" -->

Published under the [MIT](https://github.com/HugoRCD/nuxt-mcp-toolkit/blob/main/LICENSE) license.
Made by [@HugoRCD](https://github.com/HugoRCD) and [community](https://github.com/HugoRCD/nuxt-mcp-toolkit/graphs/contributors) 💛
<br><br>
<a href="https://github.com/HugoRCD/nuxt-mcp-toolkit/graphs/contributors">
<img src="https://contrib.rocks/image?repo=HugoRCD/nuxt-mcp-toolkit" />
</a>

<!-- /automd -->
