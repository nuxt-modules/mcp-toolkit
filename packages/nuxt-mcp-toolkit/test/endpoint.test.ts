import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, $fetch, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests } from './helpers/mcp-setup.js'

describe('Endpoint', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  beforeAll(async () => {
    const baseUrl = url('/')
    const baseUrlObj = new URL(baseUrl)
    const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
    const mcpUrl = new URL('/mcp', origin)
    await setupMcpClient(mcpUrl)
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should have the /mcp endpoint accessible', async () => {
    // Try to fetch the endpoint (it should redirect browsers, but we can check it exists)
    try {
      await $fetch('/mcp', {
        headers: {
          Accept: 'application/json',
        },
      })
    }
    catch (error: unknown) {
      // The endpoint might return an error for non-MCP requests, but it should exist
      // We just need to verify it's not a 404
      const httpError = error as { statusCode?: number }
      expect(httpError.statusCode).not.toBe(404)
    }
  })
})
