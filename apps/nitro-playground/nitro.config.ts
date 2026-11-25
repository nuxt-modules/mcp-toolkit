import { defineConfig } from 'nitro'
import mcp from 'nitro-mcp-toolkit/module'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  // Nitro only scans for file-based routes once a `serverDir` is set. MCP
  // discovery does not depend on it; the inspector route below does.
  serverDir: 'server',
  modules: [mcp(), mcp({ route: '/admin/mcp', dir: 'server/mcp-admin' })],
  devServer: {
    // The toolkit is a plain workspace dependency; `pnpm dev:prepare` stubs its
    // dist to source, so watching that source is what makes edits reload here.
    watch: ['../../packages/nitro-mcp-toolkit/src'],
  },
})
