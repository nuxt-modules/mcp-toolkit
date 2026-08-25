import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('llms.txt integration disabled', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/llms-disabled', import.meta.url)),
  })

  it('does not touch /llms.txt when `mcp.llms` is false', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).not.toContain('## MCP Server')
    expect(txt).not.toContain('/mcp')
  })
})
