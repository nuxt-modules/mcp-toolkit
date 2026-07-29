import { fileURLToPath } from 'node:url'
import { defineConfig } from 'nitro'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  // Nitro only scans for file-based routes once a `serverDir` is set.
  serverDir: 'server',
  // Lets the fixture import the public specifier while resolving to source, so
  // the e2e run never depends on a previous build.
  alias: {
    'nitro-mcp-toolkit': fileURLToPath(new URL('../../../src/runtime/index.ts', import.meta.url)),
  },
})
