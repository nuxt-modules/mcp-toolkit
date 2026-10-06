import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, $fetch, useTestContext } from '@nuxt/test-utils/e2e'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { cleanupMcpTests, createMcpClient } from './helpers/mcp-setup.js'

describe('MCP Nitro Hooks', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/hooks', import.meta.url)),
  })

  afterAll(async () => {
    await cleanupMcpTests()
  })

  it('includes the runtime hook types in the server tsconfig', () => {
    const include = useTestContext().nuxt?.options.nitro.typescript?.tsConfig?.include ?? []
    const hooksDts = include.flatMap(path => path?.includes('server/types/hooks') ? [path] : [])

    expect(hooksDts).toHaveLength(1)
    expect(hooksDts.every(path => existsSync(path))).toBe(true)
  })

  it('should render the page', async () => {
    const html = await $fetch('/')
    expect(html).toContain('<div>hooks fixture</div>')
  })

  it('mcp:server:created can register tools dynamically', async () => {
    const client: Client = await createMcpClient('/mcp', 'hooks-late-register')
    try {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).toContain('late_tool')

      const result = await client.callTool({ name: 'late_tool', arguments: {} })
      const content = result.content as Array<{ type: string, text?: string }>
      const text = content.find(c => c.type === 'text')?.text
      expect(text).toBe('late-result')
    }
    finally {
      await client.close()
    }
  })

  it('mcp:config:resolved can mutate the resolved config to filter definitions', async () => {
    const client: Client = await createMcpClient('/mcp', 'hooks-config-filter')
    try {
      const { tools } = await client.listTools()
      const names = tools.map(t => t.name)
      expect(names).toContain('public_tool')
      expect(names).not.toContain('admin_tool')
    }
    finally {
      await client.close()
    }
  })

  it('mcp:config:resolved can mutate non-tools fields on a definition', async () => {
    const client: Client = await createMcpClient('/mcp', 'hooks-config-mutate')
    try {
      const { tools } = await client.listTools()
      const publicTool = tools.find(t => t.name === 'public_tool')
      expect(publicTool?.description).toMatch(/^\[mutated\] /)
    }
    finally {
      await client.close()
    }
  })

  it('mcp:tool:called reports every call, including cache hits and thrown errors', async () => {
    const client: Client = await createMcpClient('/mcp', 'hooks-tool-called')
    try {
      const first = await client.callTool({ name: 'cached_tool', arguments: {} })
      const second = await client.callTool({ name: 'cached_tool', arguments: {} })
      const failed = await client.callTool({ name: 'failing_tool', arguments: {} })

      expect(first.content).toEqual([{ type: 'text', text: 'runs: 1' }])
      expect(second.content).toEqual([{ type: 'text', text: 'runs: 1' }])
      expect(failed.isError).toBe(true)
    }
    finally {
      await client.close()
    }

    const calls = await $fetch<{ name: string, isError: boolean, durationMs: number, path: string }[]>('/api/tool-calls')
    const reported = calls.filter(call => call.name === 'cached_tool' || call.name === 'failing_tool')

    expect(reported.map(({ name, isError, path }) => ({ name, isError, path }))).toEqual([
      { name: 'cached_tool', isError: false, path: '/mcp' },
      { name: 'cached_tool', isError: false, path: '/mcp' },
      { name: 'failing_tool', isError: true, path: '/mcp' },
    ])
    for (const call of reported) {
      expect(call.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('throwing inside a hook listener does not break the request', async () => {
    const client: Client = await createMcpClient('/mcp', 'hooks-throwing')
    try {
      const result = await client.callTool({ name: 'public_tool', arguments: {} })
      expect(result).toBeDefined()
      expect(result.isError).not.toBe(true)
    }
    finally {
      await client.close()
    }
  })
})
