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

## 📖 Configuration

Add the module to your `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  modules: ['@hrcd/mcp'],
  mcp: {
    name: 'My MCP Server',
    version: '1.0.0',
    route: '/mcp', // Default route for the MCP server
  },
})
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the MCP server |
| `route` | `string` | `'/mcp'` | Path for the MCP endpoint |
| `browserRedirect` | `string` | `'/'` | Redirect URL when a browser accesses the MCP endpoint |
| `name` | `string` | `''` | Name of the MCP server |
| `version` | `string` | `'1.0.0'` | Version of the MCP server |
| `dir` | `string` | `'mcp'` | Base directory for MCP definitions (relative to `server/`). The module will look for `tools/`, `resources/`, and `prompts/` subdirectories |

## 📚 Usage

### Creating a Tool

Create a file in `server/mcp/tools/` (or your custom path):

```typescript
// server/mcp/tools/echo.ts
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

### Creating a Resource

Create a file in `server/mcp/resources/`:

```typescript
// server/mcp/resources/readme.ts
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export default defineMcpResource({
  name: 'readme',
  title: 'README',
  uri: 'file:///README.md',
  metadata: {
    description: 'Project README file',
    mimeType: 'text/markdown',
  },
  handler: async (uri: URL) => {
    const filePath = fileURLToPath(uri)
    const content = await readFile(filePath, 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'text/markdown',
        text: content,
      }],
    }
  },
})
```

### Creating a Prompt

Create a file in `server/mcp/prompts/`:

```typescript
// server/mcp/prompts/greeting.ts
export default defineMcpPrompt({
  name: 'greeting',
  title: 'Greeting',
  description: 'Generate a personalized greeting message',
  handler: async () => {
    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Good ${timeOfDay}! How can I help you today?`,
        },
      }],
    }
  },
})
```

## 🔧 Custom Paths

### Changing the Base Directory

If you want to use a different base directory instead of `mcp`, you can configure it:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@hrcd/mcp'],
  mcp: {
    dir: './my-mcp', // Relative to server/ directory
  },
})
```

This will look for definitions in:
- `server/my-mcp/tools/`
- `server/my-mcp/resources/`
- `server/my-mcp/prompts/`

### Extending Paths with Hooks

For more advanced use cases, you can use the `mcp:definitions:paths` hook to add additional directories to scan. This is useful when you want to share definitions across multiple modules or layers.

You can use the hook in a custom Nuxt module:

```typescript
// my-module.ts
export default defineNuxtModule({
  setup(options, nuxt) {
    nuxt.hook('mcp:definitions:paths', (paths) => {
      // Add additional paths for tools
      paths.tools.push('shared/tools')
      // Add additional paths for resources
      paths.resources.push('shared/resources')
      // Add additional paths for prompts
      paths.prompts.push('shared/prompts')
    })
  },
})
```

Or in your `nuxt.config.ts`:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@hrcd/mcp'],
  hooks: {
    'mcp:definitions:paths'(paths) {
      paths.tools.push('shared/tools')
      paths.resources.push('shared/resources')
      paths.prompts.push('shared/prompts')
    },
  },
})
```

Paths are relative to the `server/` directory of each Nuxt layer.

## 🎯 Examples

The module automatically discovers all `.ts`, `.js`, `.mts` or `.mjs` files in the configured directories. You can organize your definitions however you want:

```
server/
  mcp/
    tools/
      calculator.ts
      weather.ts
    resources/
      files.ts
      database.ts
    prompts/
      summarize.ts
      translate.ts
```

## 📝 TypeScript Types

The module provides TypeScript types for a better development experience:

- `defineMcpTool` - Define tools with Zod validation
- `defineMcpResource` - Define resources
- `defineMcpPrompt` - Define prompts

All helpers are auto-imported in your server files.

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
