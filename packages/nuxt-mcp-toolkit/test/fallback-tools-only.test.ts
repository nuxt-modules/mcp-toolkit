import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createMcpClient } from './helpers/mcp-setup.js'

describe('Discovery fallback: tools-only', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/tools-only', import.meta.url)),
  })

  let client: Client

  beforeAll(async () => {
    client = await createMcpClient('/mcp', 'tools-only-client')
  })

  afterAll(async () => {
    await client.close()
  })

  it('lists tools and returns empty prompts/resources discovery responses', async () => {
    const tools = await client.listTools()
    const prompts = await client.listPrompts()
    const resources = await client.listResources()
    const resourceTemplates = await client.listResourceTemplates()

    expect(tools.tools).toHaveLength(1)
    expect(tools.tools[0]?.name).toBe('echo_tool')
    expect(prompts.prompts).toEqual([])
    expect(resources.resources).toEqual([])
    expect(resourceTemplates.resourceTemplates).toEqual([])
  })

  it('keeps prompt and resource fetches as not-found errors', async () => {
    await expect(client.getPrompt({
      name: 'missing_prompt',
    })).rejects.toMatchObject({
      message: expect.stringContaining('Prompt missing_prompt not found'),
    })

    await expect(client.readResource({
      uri: 'test://resource/missing',
    })).rejects.toMatchObject({
      message: expect.stringContaining('Resource test://resource/missing not found'),
    })
  })
})
