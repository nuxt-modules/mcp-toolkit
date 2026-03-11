import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createMcpClient } from './helpers/mcp-setup.js'

describe('Discovery fallback: prompts-only', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/prompts-only', import.meta.url)),
  })

  let client: Client

  beforeAll(async () => {
    client = await createMcpClient('/mcp', 'prompts-only-client')
  })

  afterAll(async () => {
    await client.close()
  })

  it('lists prompts and returns empty tools/resources discovery responses', async () => {
    const tools = await client.listTools()
    const prompts = await client.listPrompts()
    const resources = await client.listResources()
    const resourceTemplates = await client.listResourceTemplates()

    expect(tools.tools).toEqual([])
    expect(prompts.prompts).toHaveLength(1)
    expect(prompts.prompts[0]?.name).toBe('test_prompt')
    expect(resources.resources).toEqual([])
    expect(resourceTemplates.resourceTemplates).toEqual([])
  })

  it('returns a tool error result when tools are absent', async () => {
    const result = await client.callTool({
      name: 'missing_tool',
      arguments: {},
    })

    expect(result.isError).toBe(true)
    const content = result.content as Array<{ type: string, text?: string }>
    const textContent = content.find(item => item.type === 'text')
    expect(textContent?.text).toContain('Tool missing_tool not found')
  })
})
