import { defineConfig } from 'nitro'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  // Nitro only scans for file-based routes once a `serverDir` is set.
  serverDir: 'server',
  devServer: {
    // The toolkit is a plain workspace dependency; `pnpm dev:prepare` stubs its
    // dist to source, so watching that source is what makes edits reload here.
    watch: ['../../packages/nitro-mcp-toolkit/src'],
  },
})
