import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup } from '@nuxt/test-utils/e2e'
import {
  cleanupMcpTests,
  createMcpClient,
  setupMcpClient,
  createMcpUrl,
} from './helpers/mcp-setup.js'

interface ToolMeta {
  group?: string
  tags?: string[]
  filename?: string
  handler?: string
}

describe('Handlers Organization', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/handlers-organization', import.meta.url)),
  })

  beforeAll(async () => {
    await setupMcpClient(createMcpUrl('/mcp'))
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  describe('default `/mcp` handler with `defaultHandlerStrategy: orphans`', () => {
    it('exposes only orphan tools (no folder-handler attribution)', async () => {
      const client = await createMcpClient('/mcp', 'default-client')
      try {
        const { tools } = await client.listTools()
        const names = tools.map(t => t.name).sort()
        expect(names).toEqual(['orphan-tool', 'searchable-tool'])
      }
      finally {
        await client.close()
      }
    })

    it('exposes only orphan resources', async () => {
      const client = await createMcpClient('/mcp', 'default-resources-client')
      try {
        const { resources } = await client.listResources()
        const uris = resources.map(r => r.uri).sort()
        expect(uris).toEqual(['test://orphan'])
      }
      finally {
        await client.close()
      }
    })

    it('exposes only orphan prompts', async () => {
      const client = await createMcpClient('/mcp', 'default-prompts-client')
      try {
        const { prompts } = await client.listPrompts()
        const names = prompts.map(p => p.name).sort()
        expect(names).toEqual(['orphan-prompt'])
      }
      finally {
        await client.close()
      }
    })
  })

  describe('folder handler `/mcp/admin`', () => {
    it('exposes tools attached via folder convention', async () => {
      const client = await createMcpClient('/mcp/admin', 'admin-client')
      try {
        const { tools } = await client.listTools()
        const names = tools.map(t => t.name).sort()
        expect(names).toEqual(['delete-user'])
      }
      finally {
        await client.close()
      }
    })

    it('marks folder-attached tools with `_meta.handler`', async () => {
      const client = await createMcpClient('/mcp/admin', 'admin-meta-client')
      try {
        const { tools } = await client.listTools()
        const deleteUser = tools.find(t => t.name === 'delete-user')
        expect((deleteUser?._meta as ToolMeta)?.handler).toBe('admin')
      }
      finally {
        await client.close()
      }
    })

    it('exposes prompts attached via folder convention', async () => {
      const client = await createMcpClient('/mcp/admin', 'admin-prompts-client')
      try {
        const { prompts } = await client.listPrompts()
        const names = prompts.map(p => p.name).sort()
        expect(names).toEqual(['admin-help'])
      }
      finally {
        await client.close()
      }
    })
  })

  describe('folder handler `/mcp/widgets`', () => {
    it('exposes its folder-attached tools', async () => {
      const client = await createMcpClient('/mcp/widgets', 'widgets-client')
      try {
        const { tools } = await client.listTools()
        const names = tools.map(t => t.name).sort()
        expect(names).toEqual(['widget'])
      }
      finally {
        await client.close()
      }
    })
  })

  describe('folder handler `/mcp/filtered` with `getMcpTools` function form', () => {
    it('resolves tools at request time from the global pool by tag', async () => {
      const client = await createMcpClient('/mcp/filtered', 'filtered-client')
      try {
        const { tools } = await client.listTools()
        const names = tools.map(t => t.name).sort()
        expect(names).toEqual(['searchable-tool'])
      }
      finally {
        await client.close()
      }
    })
  })
})
