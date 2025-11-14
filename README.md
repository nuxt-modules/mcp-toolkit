# Nuxt MCP Module

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

A Nuxt module to easily create a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server directly in your Nuxt application. Define MCP tools, resources, and prompts with a simple and intuitive API.

## ✨ Features

- 🛠️ **Simple tool definitions** - Create MCP tools with Zod validation
- 📦 **Resource management** - Expose resources accessible via URI
- 💬 **Custom prompts** - Create reusable prompts for your assistants
- 🔧 **Flexible configuration** - Customize paths and routes to fit your needs
- 📝 **Native TypeScript** - Full TypeScript support with auto-completion
- 🎯 **Auto-discovery** - Automatic discovery of definitions in your project
- 🚀 **Multiple handlers** - Create multiple MCP endpoints in one application

## 🚀 Installation

```bash
npm install @hrcd/mcp zod@3
# or
pnpm add @hrcd/mcp zod@3
# or
yarn add @hrcd/mcp zod@3
# or
bun add @hrcd/mcp zod@3
```

**Note:** This module requires Zod v3 as a peer dependency. Zod v4 is not compatible with the MCP SDK.

## 📖 Quick Start

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@hrcd/mcp'],
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
  name: 'echo',
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

## 📚 Documentation

📖 **[Full Documentation →](https://github.com/HugoRCD/nuxt-mcp-module/tree/main/docs)**

The complete documentation includes:

- [Getting Started](docs/content/1.getting-started) - Installation and quick start guide
- [Core Concepts](docs/content/2.core-concepts) - Tools, resources, prompts, and handlers
- [Advanced Topics](docs/content/3.advanced) - Custom paths, multiple handlers, TypeScript, hooks
- [Examples](docs/content/4.examples) - Real-world examples and patterns
- [API Reference](docs/content/5.reference) - Complete API and configuration reference

## 🔧 Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the MCP server |
| `route` | `string` | `'/mcp'` | Path for the MCP endpoint |
| `browserRedirect` | `string` | `'/'` | Redirect URL when a browser accesses the MCP endpoint |
| `name` | `string` | `''` | Name of the MCP server |
| `version` | `string` | `'1.0.0'` | Version of the MCP server |
| `dir` | `string` | `'mcp'` | Base directory for MCP definitions (relative to `server/`) |

See the [Configuration Reference](docs/content/5.reference/2.configuration-reference) for detailed information.

## 📝 TypeScript Support

All helpers are auto-imported in your server files:

- `defineMcpTool` - Define tools with Zod validation
- `defineMcpResource` - Define resources
- `defineMcpPrompt` - Define prompts
- `defineMcpHandler` - Create custom MCP endpoints

Full TypeScript support with complete type inference. See the [TypeScript Guide](docs/content/3.advanced/3.typescript) for more information.

## 🤝 Contributing

Contributions are welcome! Feel free to open an issue or submit a pull request.

### Local Development

```bash
# Install dependencies
npm install

# Generate type stubs
npm run dev:prepare

# Develop with playground
npm run dev

# Build playground
npm run dev:build

# Lint
npm run lint

# Test
npm run test
npm run test:watch

# Release
npm run release
```

## 📄 License

MIT

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@hrcd/mcp/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@hrcd/mcp

[npm-downloads-src]: https://img.shields.io/npm/dm/@hrcd/mcp.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@hrcd/mcp

[license-src]: https://img.shields.io/npm/l/@hrcd/mcp.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@hrcd/mcp

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
