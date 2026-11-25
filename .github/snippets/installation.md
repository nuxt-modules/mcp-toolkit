This branch documents the 1.0 beta API and requires Nuxt 4.6 or later. Install the beta explicitly:

```sh
pnpm add @nuxtjs/mcp-toolkit@beta zod
```

Before the first beta publication, use the exact package-preview command from the reviewed PR. An unversioned install selects stable 0.x while `latest` remains there.

Register the module and create typed definitions using the [Nuxt package guide](packages/nuxt-mcp-toolkit/README.md). Existing applications should follow the [migration guide](apps/docs/content/1.getting-started/7.beta-migration.md).
