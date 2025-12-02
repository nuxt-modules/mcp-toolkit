![Nuxt MCP Toolkit](https://raw.githubusercontent.com/nuxt-modules/mcp-toolkit/main/assets/banner.jpg)

[![Install MCP in Cursor](https://mcp-toolkit.nuxt.dev/mcp/badge.svg)](https://mcp-toolkit.nuxt.dev/mcp/deeplink)
[![Install MCP in VS Code](https://mcp-toolkit.nuxt.dev/mcp/badge.svg?ide=vscode)](https://mcp-toolkit.nuxt.dev/mcp/deeplink?ide=vscode)

# Nuxt MCP Toolkit

<!-- automd:badges color="black" license name="@nuxtjs/mcp-toolkit" -->

[![npm version](https://img.shields.io/npm/v/@nuxtjs/mcp-toolkit?color=black)](https://npmjs.com/package/@nuxtjs/mcp-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/@nuxtjs/mcp-toolkit?color=black)](https://npm.chart.dev/@nuxtjs/mcp-toolkit)
[![license](https://img.shields.io/github/license/nuxt-modules/mcp-toolkit?color=black)](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)

<!-- /automd -->

A Nuxt module to easily create a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server directly in your Nuxt application. Define MCP tools, resources, and prompts with zero configuration - just create files and they're automatically discovered and registered.

## ✨ Features

<!-- automd:file src="../../.github/snippets/features.md" -->

- 🎯 **Zero Configuration** - Automatic discovery of tools, resources, and prompts
- 📦 **File-based** - Organize definitions in intuitive directory structures
- 🚀 **Multiple Handlers** - Create multiple MCP endpoints in a single app
- 🔍 **Built-in Inspector** - Visual debugging tool in Nuxt DevTools
- 📝 **TypeScript First** - Full type safety with auto-imports
- 🔒 **Zod Validation** - Built-in input/output validation

<!-- /automd -->

## 🚀 Installation

<!-- automd:file src="../../.github/snippets/installation.md" -->

Use `nuxt` to install the module automatically:

```bash
npx nuxt module add mcp-toolkit
```

Or install manually:

```bash
# npm
npm install -D @nuxtjs/mcp-toolkit zod

# yarn
yarn add -D @nuxtjs/mcp-toolkit zod

# pnpm
pnpm add -D @nuxtjs/mcp-toolkit zod

# bun
bun add -D @nuxtjs/mcp-toolkit zod
```

<!-- /automd -->

## 📖 Quick Start

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
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

## 📚 Documentation

📖 **[Full Documentation →](https://mcp-toolkit.nuxt.dev)**

## 🤝 Contributing

<!-- automd:file src="../../.github/snippets/contributing.md" -->

Contributions are welcome! Feel free to open an issue or submit a pull request.

```bash
# Install dependencies
pnpm install

# Generate type stubs
pnpm run dev:prepare

# Start the playground
pnpm run dev

# Run tests
pnpm run test
```

<!-- /automd -->

## 📄 License

<!-- automd:file src="../../.github/snippets/license.md" -->

Published under the [MIT](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE) license.

Made by [@HugoRCD](https://github.com/HugoRCD) and [community](https://github.com/nuxt-modules/mcp-toolkit/graphs/contributors) 💛

<a href="https://github.com/nuxt-modules/mcp-toolkit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nuxt-modules/mcp-toolkit" />
</a>

<!-- /automd -->
