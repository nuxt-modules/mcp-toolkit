import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { createMcpClient } from './helpers/mcp-setup'

describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('renders the index page', async () => {
    // Get response to a server-rendered page with `$fetch`.
    const html = await $fetch('/')
    expect(html).toContain('<div>basic</div>')
  })

  it('serves ordinary definitions without registering Vue components as MCP Apps', async () => {
    const client = await createMcpClient()
    try {
      const { tools } = await client.listTools()
      const { resources } = await client.listResources()
      expect(tools.map(tool => tool.name)).not.toContain('legacy-widget')
      expect(resources.map(resource => resource.uri)).not.toContain('ui://mcp-app/legacy-widget')
      expect(await client.callTool({ name: 'string_tool', arguments: { name: 'Ada' } })).toMatchObject({
        content: [{ type: 'text', text: 'Hello Ada' }],
      })
      expect(await client.readResource({ uri: 'test://resource/test' })).toMatchObject({
        contents: [{ text: 'This is test resource content' }],
      })
      expect(await client.getPrompt({ name: 'string_prompt' })).toMatchObject({
        messages: [{ role: 'user', content: { type: 'text', text: 'You are a helpful assistant that helps with code review.' } }],
      })
    }
    finally {
      await client.close()
    }
  })
})
