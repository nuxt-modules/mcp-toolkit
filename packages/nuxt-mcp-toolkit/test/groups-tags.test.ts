import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests, getMcpClient } from './helpers/mcp-setup.js'

interface ToolMeta {
  group?: string
  tags?: string[]
  filename?: string
}

describe('Groups and Tags', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/groups-tags', import.meta.url)),
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

  describe('tools', () => {
    it('should auto-infer group from subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const deleteUser = tools.find(t => t.name === 'delete-user')

      expect(deleteUser).toBeDefined()
      expect((deleteUser?._meta as ToolMeta)?.group).toBe('admin')
    })

    it('should auto-infer group for all tools in the same subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const stats = tools.find(t => t.name === 'stats')

      expect(stats).toBeDefined()
      expect((stats?._meta as ToolMeta)?.group).toBe('admin')
    })

    it('should auto-infer group from nested subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const listPages = tools.find(t => t.name === 'list-pages')

      expect(listPages).toBeDefined()
      expect((listPages?._meta as ToolMeta)?.group).toBe('content')
    })

    it('should use explicit group when provided', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const search = tools.find(t => t.name === 'public-search')

      expect(search).toBeDefined()
      expect((search?._meta as ToolMeta)?.group).toBe('search')
    })

    it('should include tags in _meta', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const deleteUser = tools.find(t => t.name === 'delete-user')

      expect(deleteUser).toBeDefined()
      expect((deleteUser?._meta as ToolMeta)?.tags).toEqual(['destructive', 'user-management'])
    })

    it('should have no group when tool is at root with no explicit group', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const noGroup = tools.find(t => t.name === 'no-group')

      expect(noGroup).toBeDefined()
      expect((noGroup?._meta as ToolMeta)?.group).toBeUndefined()
    })

    it('should use explicit group from root-level tool', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const explicit = tools.find(t => t.name === 'explicit-override')

      expect(explicit).toBeDefined()
      expect((explicit?._meta as ToolMeta)?.group).toBe('custom-group')
      expect((explicit?._meta as ToolMeta)?.tags).toEqual(['special'])
    })

    it('should prefer explicit group over auto-inferred group in subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const overridden = tools.find(t => t.name === 'explicit-group-in-subdir')

      expect(overridden).toBeDefined()
      expect((overridden?._meta as ToolMeta)?.group).toBe('custom-override')
      expect((overridden?._meta as ToolMeta)?.tags).toEqual(['override'])
    })

    it('should list all tools including those in subdirectories', async () => {
      const client = getMcpClient()
      if (!client) return

      const { tools } = await client.listTools()
      const names = tools.map(t => t.name).sort()

      expect(names).toContain('delete-user')
      expect(names).toContain('stats')
      expect(names).toContain('explicit-group-in-subdir')
      expect(names).toContain('list-pages')
      expect(names).toContain('public-search')
      expect(names).toContain('no-group')
      expect(names).toContain('explicit-override')
    })

    it('should be callable for tools in subdirectories', async () => {
      const client = getMcpClient()
      if (!client) return

      const result = await client.callTool({
        name: 'delete-user',
        arguments: { userId: 'user-123' },
      })

      const content = result.content as Array<{ type: string, text?: string }>
      expect(content[0]?.text).toBe('Deleted user user-123')
    })
  })

  describe('resources', () => {
    it('should list resources from subdirectories', async () => {
      const client = getMcpClient()
      if (!client) return

      const { resources } = await client.listResources()
      const uris = resources.map(r => r.uri).sort()

      expect(uris).toContain('test://resource/root')
      expect(uris).toContain('test://resource/app-settings')
    })

    it('should read a resource from a subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const result = await client.readResource({ uri: 'test://resource/app-settings' })
      const text = (result.contents[0] as { text?: string })?.text
      expect(text).toContain('theme')
    })
  })

  describe('prompts', () => {
    it('should list prompts from subdirectories', async () => {
      const client = getMcpClient()
      if (!client) return

      const { prompts } = await client.listPrompts()
      const names = prompts.map(p => p.name).sort()

      expect(names).toContain('test-prompt')
      expect(names).toContain('welcome')
    })

    it('should get a prompt from a subdirectory', async () => {
      const client = getMcpClient()
      if (!client) return

      const result = await client.getPrompt({ name: 'welcome' })
      const text = (result.messages[0]?.content as { text?: string })?.text
      expect(text).toContain('Welcome')
    })
  })
})
