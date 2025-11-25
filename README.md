![Nuxt MCP Toolkit](https://raw.githubusercontent.com/nuxt-modules/mcp-toolkit/main/assets/banner.jpg)

# Nuxt MCP Toolkit

<!-- automd:badges color="black" license name="nuxt-mcp-toolkit" -->

[![npm version](https://img.shields.io/npm/v/nuxt-mcp-toolkit?color=black)](https://npmjs.com/package/nuxt-mcp-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/nuxt-mcp-toolkit?color=black)](https://npm.chart.dev/nuxt-mcp-toolkit)
[![license](https://img.shields.io/github/license/nuxt-modules/mcp-toolkit?color=black)](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE)

<!-- /automd -->

A Nuxt module to easily create a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server directly in your Nuxt application. Define MCP tools, resources, and prompts with zero configuration - just create files and they're automatically discovered and registered.

## ✨ Features

<!-- automd:file src=".github/snippets/features.md" -->

- 🎯 **Zero Configuration** - Automatic discovery of tools, resources, and prompts
- 📦 **File-based** - Organize definitions in intuitive directory structures
- 🚀 **Multiple Handlers** - Create multiple MCP endpoints in a single app
- 🔍 **Built-in Inspector** - Visual debugging tool in Nuxt DevTools
- 📝 **TypeScript First** - Full type safety with auto-imports
- 🔒 **Zod Validation** - Built-in input/output validation

<!-- /automd -->

## 🚀 Installation

<!-- automd:file src=".github/snippets/installation.md" -->

Use `nuxt` to install the module automatically:

```bash
npx nuxt module add nuxt-mcp-toolkit
```

Or install manually:

```bash
# npm
npm install -D nuxt-mcp-toolkit zod@^3

# yarn
yarn add -D nuxt-mcp-toolkit zod@^3

# pnpm
pnpm add -D nuxt-mcp-toolkit zod@^3

# bun
bun add -D nuxt-mcp-toolkit zod@^3
```

> **Note:** Zod v3 is required. Zod v4 is not yet compatible with the MCP SDK.

<!-- /automd -->

## 📖 Documentation

📖 **[Full Documentation →](https://mcp-toolkit.nuxt.dev)**

## 🤝 Contributing

<!-- automd:file src=".github/snippets/contributing.md" -->

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

## ❓ Questions & Support

<!-- automd:file src=".github/snippets/support.md" -->

- **Issues**: [Open an issue](https://github.com/nuxt-modules/mcp-toolkit/issues) for bugs or feature requests
- **Discussions**: [Join the discussion](https://github.com/nuxt-modules/mcp-toolkit/discussions) for questions and ideas
- **X**: Follow [@hugorcd](https://twitter.com/hugorcd) for updates

<!-- /automd -->

## 📄 License

<!-- automd:file src=".github/snippets/license.md" -->

Published under the [MIT](https://github.com/nuxt-modules/mcp-toolkit/blob/main/LICENSE) license.

Made by [@HugoRCD](https://github.com/HugoRCD) and [community](https://github.com/nuxt-modules/mcp-toolkit/graphs/contributors) 💛

<a href="https://github.com/nuxt-modules/mcp-toolkit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nuxt-modules/mcp-toolkit" />
</a>

<!-- /automd -->
