import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('llms.txt integration', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/llms', import.meta.url)),
  })

  it('appends an MCP Server section to /llms.txt', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).toContain('## MCP Server')
  })

  it('advertises the absolute streamable HTTP endpoint', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).toContain('[Fixture MCP](https://fixture.test/mcp)')
  })

  it('uses the MCP description as the section description', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).toContain('Fixture MCP server used in tests.')
  })

  it('links the browser redirect as documentation entry point', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).toContain('[MCP documentation](https://fixture.test/docs/mcp)')
  })

  it('preserves user-defined sections', async () => {
    const txt = await $fetch<string>('/llms.txt')

    expect(txt).toContain('## Docs')
    expect(txt).toContain('[Home](https://fixture.test/)')
  })
})
