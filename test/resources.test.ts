import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

describe('Resources', async () => {
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

  it('should list resources via MCP client', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const resources = await client.listResources()

    expect(resources).toBeDefined()
    expect(resources.resources).toBeInstanceOf(Array)
    expect(resources.resources.length).toBeGreaterThan(0)
  })

  it('should include the test_resource in the resources list', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const resources = await client.listResources()
    const testResource = resources.resources.find(resource => resource.name === 'test_resource')

    expect(testResource, 'test_resource should be present in the resources list').toBeDefined()
    expect(testResource?.name, `Expected resource name to be 'test_resource', but got '${testResource?.name}'`).toBe('test_resource')
    expect(testResource?.uri, `Expected URI to match, but got '${testResource?.uri}'`).toBe('test://resource/test')
  })

  it('should be able to read the test_resource', async () => {
    const client = getMcpClient()
    if (!client) {
      return
    }

    const result = await client.readResource({
      uri: 'test://resource/test',
    })

    expect(result, 'Resource read should return a result').toBeDefined()
    expect(result.contents).toBeInstanceOf(Array)
    expect(result.contents.length).toBeGreaterThan(0)

    const firstContent = result.contents[0]
    if (!firstContent) {
      throw new Error('First content should be defined')
    }
    expect(firstContent.uri).toBe('test://resource/test')
    expect(firstContent.mimeType).toBe('text/plain')
    expect(firstContent.text).toContain('test resource content')
  })
})
