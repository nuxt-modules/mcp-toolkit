import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

/**
 * Test for MCP definition override behavior
 *
 * When multiple files with the same name exist across different layers,
 * only one should be loaded (no duplicates).
 *
 * Expected behavior: The app's definition overrides the layer's definition
 * because the app is processed last and has priority over extended layers.
 */
describe('Override', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/override', import.meta.url)),
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

  it('should have only one override_tool (not duplicated)', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const tools = await client.listTools()
    const overrideTools = tools.tools.filter(tool => tool.name === 'override_tool')

    expect(overrideTools.length, 'There should be exactly one override_tool').toBe(1)
  })

  it('should use the app tool that overrides the layer tool (app has priority)', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const inputValue = 'test input'

    const result = await client.callTool({
      name: 'override_tool',
      arguments: {
        input: inputValue,
      },
    })

    expect(result, 'Tool call should return a result').toBeDefined()
    expect(result.content, 'Result content should be an array').toBeInstanceOf(Array)
    const content = result.content as Array<{ type: string, text?: string }>

    const textContent = content.find(c => c.type === 'text')
    expect(textContent, 'Result should contain text content').toBeDefined()

    // The app's tool overrides the layer's tool (app is processed last)
    // So we expect "Base result" (from the app) NOT "Overridden result" (from the layer)
    expect(
      textContent?.text,
      `Expected the app tool to override the layer tool. Got: ${textContent?.text}`,
    ).toContain('Base result')
  })
})
