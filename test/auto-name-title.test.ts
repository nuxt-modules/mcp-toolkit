import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

describe('Auto-generated name and title', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/auto-name-title', import.meta.url)),
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

  it('should auto-generate name and title from filename for tools', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const tools = await client.listTools()
    const tool = tools.tools.find(t => t.name === 'list-documentation')

    expect(tool).toBeDefined()
    expect(tool?.name).toBe('list-documentation')
    expect(tool?.title).toBe('List Documentation')
  })

  it('should use explicit name when provided (tools)', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const tools = await client.listTools()
    const tool = tools.tools.find(t => t.name === 'custom-name')

    expect(tool).toBeDefined()
    expect(tool?.name).toBe('custom-name')
    expect(tool?.title).toBe('Custom Name')
  })

  it('should auto-generate name from filename for resources', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const resources = await client.listResources()
    const resource = resources.resources.find(r => r.name === 'project-readme')

    expect(resource).toBeDefined()
    expect(resource?.name).toBe('project-readme')
  })

  it('should auto-generate name and title from filename for prompts', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const prompts = await client.listPrompts()
    const prompt = prompts.prompts.find(p => p.name === 'greeting-message')

    expect(prompt).toBeDefined()
    expect(prompt?.name).toBe('greeting-message')
    expect(prompt?.title).toBe('Greeting Message')
  })
})
