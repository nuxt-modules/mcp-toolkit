import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['verbose'],
    testTimeout: process.env.CI ? 60_000 : 20_000,
    retry: process.env.CI ? 1 : 0,
  },
})
