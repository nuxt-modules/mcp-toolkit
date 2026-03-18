import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import { cleanupMcpTests, createMcpClient } from './helpers/mcp-setup.js'

describe('Dynamic MCP Definitions', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/dynamic-definitions', import.meta.url)),
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('should include tools without an enabled guard', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-1')
    try {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).toContain('public_tool')
    }
    finally {
      await client.close()
    }
  })

  it('should include tools where enabled returns true (middleware context)', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-2')
    try {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).toContain('admin_tool')
    }
    finally {
      await client.close()
    }
  })

  it('should exclude tools where enabled returns false', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-3')
    try {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).not.toContain('disabled_tool')
    }
    finally {
      await client.close()
    }
  })

  it('should include prompts where enabled returns true', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-4')
    try {
      const { prompts } = await client.listPrompts()
      const names = prompts.map(p => p.name)
      expect(names).toContain('dynamic_prompt')
    }
    finally {
      await client.close()
    }
  })

  it('should exclude prompts where enabled returns false', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-5')
    try {
      const { prompts } = await client.listPrompts()
      const names = prompts.map(p => p.name)
      expect(names).not.toContain('disabled_prompt')
    }
    finally {
      await client.close()
    }
  })

  it('should allow calling an enabled tool', async () => {
    const client = await createMcpClient('/mcp', 'dynamic-test-client-6')
    try {
      const result = await client.callTool({ name: 'admin_tool', arguments: {} })
      const content = result.content as Array<{ type: string, text?: string }>
      expect(content[0]?.text).toBe('admin')
    }
    finally {
      await client.close()
    }
  })
})
