import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { createMcpClient } from './helpers/mcp-setup.js'

describe('Discovery fallback: resources-only', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/resources-only', import.meta.url)),
  })

  let client: Client

  beforeAll(async () => {
    client = await createMcpClient('/mcp', 'resources-only-client')
  })

  afterAll(async () => {
    await client.close()
  })

  it('lists resources and returns empty tools/prompts discovery responses', async () => {
    const tools = await client.listTools()
    const prompts = await client.listPrompts()
    const resources = await client.listResources()
    const resourceTemplates = await client.listResourceTemplates()

    expect(tools.tools).toEqual([])
    expect(prompts.prompts).toEqual([])
    expect(resources.resources).toHaveLength(1)
    expect(resources.resources[0]?.name).toBe('test_resource')
    expect(resourceTemplates.resourceTemplates).toEqual([])
  })

  it('reads the registered resource normally', async () => {
    const result = await client.readResource({
      uri: 'test://resource/only',
    })

    expect(result.contents).toHaveLength(1)
    const content = result.contents[0]
    expect(content?.uri).toBe('test://resource/only')
    if (content && 'text' in content) {
      expect(content.text).toContain('Resource-only fixture content')
    }
    else {
      throw new Error('Expected resource content to include text')
    }
  })
})
