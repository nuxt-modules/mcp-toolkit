# nitro-mcp-toolkit

<!-- automd:badges color="black" license name="nitro-mcp-toolkit" -->

[![npm version](https://img.shields.io/npm/v/nitro-mcp-toolkit?color=black)](https://npmjs.com/package/nitro-mcp-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/nitro-mcp-toolkit?color=black)](https://npm.chart.dev/nitro-mcp-toolkit)
[![license](https://img.shields.io/github/license/nuxt-modules/mcp-toolkit?color=black)](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)

<!-- /automd -->

Create MCP (Model Context Protocol) servers directly in your Nitro application. Define tools, resources, and prompts with a simple and intuitive API.

## ✨ Features

- 🎯 **Zero Configuration** - Automatic discovery of tools, resources, and prompts
- 📦 **File-based** - Organize definitions in intuitive directory structures
- 🚀 **Multiple Handlers** - Create multiple MCP endpoints in a single app
- 📝 **TypeScript First** - Full type safety with auto-imports
- 🔒 **Zod Validation** - Built-in input/output validation

## 🚀 Installation

```bash
# npm
npm install nitro-mcp-toolkit zod

# yarn
yarn add nitro-mcp-toolkit zod

# pnpm
pnpm add nitro-mcp-toolkit zod

# bun
bun add nitro-mcp-toolkit zod
```

## 📖 Quick Start

Add the module to your `nitro.config.ts`:

```ts
import { mcpNitroModule } from 'nitro-mcp-toolkit'

export default defineNitroConfig({
  modules: [mcpNitroModule],

  runtimeConfig: {
    mcp: {
      route: '/mcp',
      name: 'My MCP Server',
      version: '1.0.0',
    },
  },
})
```

Or use `defineMcpNitroModule()` for inline configuration:

```ts
import { defineMcpNitroModule } from 'nitro-mcp-toolkit'

export default defineNitroConfig({
  modules: [
    defineMcpNitroModule({
      route: '/mcp',
      name: 'My MCP Server',
      version: '1.0.0',
    })
  ]
})
```

### Creating Tools

Create a file in `server/mcp/tools/`:

```ts
// server/mcp/tools/hello.ts
import { defineMcpTool, textResult } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  description: 'Say hello to someone',
  inputSchema: {
    name: z.string().describe('The name to greet'),
  },
  handler: async ({ name }) => {
    return textResult(`Hello, ${name}!`)
  },
})
```

### Creating Resources

Create a file in `server/mcp/resources/`:

```ts
// server/mcp/resources/readme.ts
import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  description: 'Project README file',
  file: 'README.md',
})
```

### Creating Prompts

Create a file in `server/mcp/prompts/`:

```ts
// server/mcp/prompts/greeting.ts
import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate a greeting message',
  inputSchema: {
    name: z.string(),
  },
  handler: async ({ name }) => ({
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Please greet ${name}` },
    }],
  }),
})
```

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the MCP server |
| `route` | `string` | `'/mcp'` | The route path for the MCP server endpoint |
| `browserRedirect` | `string` | `'/'` | URL to redirect to when a browser accesses the MCP endpoint |
| `name` | `string` | `'MCP Server'` | The name of the MCP server |
| `version` | `string` | `'1.0.0'` | The version of the MCP server |
| `dir` | `string` | `'mcp'` | Base directory for MCP definitions relative to server directory |

## 💚 For Nuxt Users

If you're using Nuxt, we recommend using [@nuxtjs/mcp-toolkit](https://www.npmjs.com/package/@nuxtjs/mcp-toolkit) instead, which provides:

- Nuxt DevTools integration
- `InstallButton` Vue component
- Nuxt layers support
- Automatic configuration

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
