import { fileURLToPath } from 'node:url'
import { defineConfig } from 'nitro'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  // Lets the definition files import the public specifier while resolving to
  // source, so the e2e run never depends on a previous build. The `mcp()`
  // instances come from the tests, which mount the same two servers a
  // `nitro.config.ts` would — the playground covers that path for real.
  alias: {
    'nitro-mcp-toolkit': fileURLToPath(new URL('../../../src/runtime/index.ts', import.meta.url)),
  },
})
