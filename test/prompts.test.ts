import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

describe('Prompts', async () => {
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

  it('should list prompts via MCP client', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const prompts = await client.listPrompts()

    expect(prompts).toBeDefined()
    expect(prompts.prompts).toBeInstanceOf(Array)
    expect(prompts.prompts.length).toBeGreaterThan(0)
  })

  it('should include the test_prompt in the prompts list', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const prompts = await client.listPrompts()
    const testPrompt = prompts.prompts.find(prompt => prompt.name === 'test_prompt')

    expect(testPrompt, 'test_prompt should be present in the prompts list').toBeDefined()
    expect(testPrompt?.name, `Expected prompt name to be 'test_prompt', but got '${testPrompt?.name}'`).toBe('test_prompt')
    expect(testPrompt?.description, `Expected description to match, but got '${testPrompt?.description}'`).toBe('A simple test prompt for MCP testing')
  })

  it('should be able to get the test_prompt', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const result = await client.getPrompt({
      name: 'test_prompt',
    })

    expect(result, 'Prompt call should return a result').toBeDefined()
    expect(result.messages).toBeInstanceOf(Array)
    expect(result.messages.length).toBeGreaterThan(0)

    const firstMessage = result.messages[0]
    if (!firstMessage) {
      throw new Error('First message should be defined')
    }
    expect(firstMessage.role).toBe('user')
    expect(firstMessage.content.type).toBe('text')
    if ('text' in firstMessage.content) {
      expect(firstMessage.content.text).toContain('test prompt message')
    }
  })
})
