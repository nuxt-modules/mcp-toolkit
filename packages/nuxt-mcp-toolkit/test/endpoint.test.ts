import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { setupMcpClient, cleanupMcpTests } from './helpers/mcp-setup.js'

describe('Endpoint', async () => {
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

  it('serves installation badges through the Nuxt request API', async () => {
    const response = await fetch(url('/mcp/badge.svg?label=Demo'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(await response.text()).toContain('Demo')
  })

  it('serves client installation links with Unicode server names', async () => {
    const response = await fetch(url(`/mcp/deeplink?name=${encodeURIComponent('Démo ✓')}`))
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('cursor://anysphere.cursor-deeplink/mcp/install')
    expect(html).toContain(encodeURIComponent('Démo ✓'))
  })

  it.each([
    { accept: 'application/json', status: 406, error: 'Not Acceptable' },
    { accept: 'text/event-stream', status: 405, error: 'Method not allowed' },
  ])('rejects stateless GET requests accepting $accept', async ({ accept, status, error }) => {
    const response = await fetch(url('/mcp'), {
      method: 'GET',
      headers: { accept },
    })
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error })
  })
})
