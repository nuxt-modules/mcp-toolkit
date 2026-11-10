# Nuxt MCP Starter

A Nuxt 4.6 or later app with one tool, one resource, and one prompt, using explicit imports from `@nuxtjs/mcp-toolkit/server`.

## Copy the beta template

Copy `apps/mcp-starter` from the `v1` branch after the implementation stack has merged there. Install `@nuxtjs/mcp-toolkit@beta` explicitly in the copied application; the template manifest's current `^0.24.3` dependency selects the stable line until the release process updates it.

```sh
npx giget@latest gh:nuxt-modules/mcp-toolkit/apps/mcp-starter#v1 my-nuxt-mcp
cd my-nuxt-mcp
pnpm add @nuxtjs/mcp-toolkit@beta
pnpm exec nuxt prepare
pnpm dev
```

Before the first beta publication, use the exact package-preview installation command on the reviewed PR. Preview packages let you test the implementation before merging the beta version PR.

The site serves at `http://localhost:3000`; connect an MCP client to `http://localhost:3000/mcp`. See [connection](https://mcp-toolkit.nuxt.dev/getting-started/connection) and [OAuth](https://mcp-toolkit.nuxt.dev/getting-started/oauth). Configure authentication before exposing private data.

## Develop inside this monorepo

The root workspace override selects the local package. Prepare and build the module before starting the consumer so its public server exports exist:

```sh
pnpm install
pnpm dev:prepare
pnpm build:module
pnpm dev:starter
```

## Explore the definitions

| Kind | Name | Purpose |
| --- | --- | --- |
| Tool | `ping` | Echo and health check |
| Resource | `starter-info` | Explain where definitions belong |
| Prompt | `iterate` | Bootstrap an assistant conversation |

Add files under `server/mcp/{tools,resources,prompts}`. Use complete schemas for inputs and outputs; omit empty input schemas. Deploy with a Nitro server, and test production authentication and streaming timeouts on the intended host.
