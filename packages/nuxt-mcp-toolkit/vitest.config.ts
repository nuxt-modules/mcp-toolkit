import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['verbose'],
    // Some tests boot a real Nuxt e2e server or a sandboxed Node process
    // (elicitation, codemode) and were timing out under CI's 2-core runner
    // contention even after being bumped one-by-one to 15s. A single global
    // timeout plus one CI-only retry absorbs that scheduling noise instead of
    // chasing it test-by-test.
    testTimeout: 20_000,
    retry: process.env.CI ? 1 : 0,
  },
})
