I'm using the Nuxt MCP 1.0 beta starter from `nuxt-modules/mcp-toolkit` (`apps/mcp-starter`).

Scaffolded it with:

- `npx giget@latest gh:nuxt-modules/mcp-toolkit/apps/mcp-starter#v1 my-app`

After the implementation stack lands on `v1`, install `@nuxtjs/mcp-toolkit@beta` explicitly, run `pnpm exec nuxt prepare`, then `pnpm dev`. Before the first beta publication, use the exact reviewed PR package-preview installation command. Requires Nuxt 4.6 or later.

Docs: https://mcp-toolkit.nuxt.dev
OAuth: https://mcp-toolkit.nuxt.dev/getting-started/oauth

Tools, resources, and prompts go under `server/mcp/`. Use `defineMcpTool`, `defineMcpResource`, and `defineMcpPrompt` from `@nuxtjs/mcp-toolkit/server`, with complete Zod schemas such as `z.object(...)`. Keep output schemas on typed tools; omit input schemas for definitions without arguments. Read verified identity from the current request event.

Once my project is open in the editor, ask me what I want this MCP server to do, then help me implement it.
