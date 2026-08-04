import { defineConfig } from 'nitro'
import mcp from 'nitro-mcp-toolkit/module'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  // Nitro only scans for file-based routes once a `serverDir` is set. MCP
  // discovery does not depend on it; the inspector route below does.
  serverDir: 'server',
  modules: [
    mcp({
      name: 'nitro-mcp-playground',
      version: '0.0.0',
      title: 'Nitro MCP Playground',
      description: 'Every definition here exercises one feature of nitro-mcp-toolkit.',
      icons: [{ src: 'https://nitro.build/icon.svg', mimeType: 'image/svg+xml' }],
      websiteUrl: 'https://github.com/nuxt-modules/mcp-toolkit',
      instructions: 'Call `whoami` first; it reports everything the server sees.',
    }),
    // A second instance, to keep two servers on one app honest: its own route,
    // its own directory, its own definition set.
    mcp({
      route: '/admin/mcp',
      dir: 'server/mcp-admin',
      name: 'nitro-mcp-playground-admin',
      version: '0.0.0',
      // The main `/mcp` server has no `auth`, so it stays open; only the admin
      // one asks for a credential. A static list is all `mcp()` can take —
      // a `validate` callback would need `createMcpHandler` in a route file.
      auth: { tokens: [process.env.MCP_ADMIN_TOKEN ?? 'dev-admin-token'] },
    }),
  ],
  devServer: {
    // The toolkit is a plain workspace dependency; `pnpm dev:prepare` stubs its
    // dist to source, so watching that source is what makes edits reload here.
    watch: ['../../packages/nitro-mcp-toolkit/src'],
  },
})
