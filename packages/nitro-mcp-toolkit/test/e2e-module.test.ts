import { rm } from 'node:fs/promises'
import { build, createNitro } from 'nitro/builder'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'
import { fixtureDir, modules } from './helpers/discovery-fixture.ts'
import { composedOptions, composedVirtual } from './helpers/composed-server.ts'
import mcp from '../src/module/index.ts'
import { MODERN_PROTOCOL_VERSION } from '../src/runtime/index.ts'
import type { Nitro } from 'nitro/types'
import type { Client } from '@modelcontextprotocol/client'

interface StandardServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

// The module is only worth anything if a file dropped in a directory is really
// served, so this goes through a full build rather than the module's own output.
describe('a built Nitro app using the module', () => {
  let nitro: Nitro
  let server: StandardServerEntry
  let client: Client
  let adminClient: Client

  beforeAll(async () => {
    nitro = await createNitro({
      rootDir: fixtureDir,
      dev: false,
      preset: 'standard',
      modules: [...modules, mcp(composedOptions)],
      virtual: composedVirtual,
    })
    await build(nitro)

    const entry = (await import(
      /* @vite-ignore */ `${nitro.options.output.serverDir}/index.mjs`
    )) as { default: StandardServerEntry }
    server = entry.default

    const handler = { fetch: (request: Request) => Promise.resolve(server.fetch(request)) }

    client = await createMcpTestClient(handler)
    adminClient = await createMcpTestClient(handler, { url: 'http://localhost/admin/mcp' })
  })

  afterAll(async () => {
    await Promise.all([client.close(), adminClient.close()])
    await nitro.close()
    await rm(new URL('./fixtures/discovery/.output', import.meta.url), {
      recursive: true,
      force: true,
    })
  })

  it('registers every discovered definition, named after its file', async () => {
    const { tools } = await client.listTools()

    expect(tools.map(({ name, title }) => ({ name, title }))).toEqual([
      { name: 'greet-visitor', title: 'Greet Visitor' },
      // The file names itself, so neither the name nor the title is derived.
      { name: 'explicitly-named', title: 'Explicitly Named' },
      { name: 'deep', title: 'Deep' },
    ])
  })

  it.each(['modern', 'legacy'] as const)(
    'serves overlays and generated imports to %s clients',
    async (era) => {
      await using composed = await createMcpTestClient(
        { fetch: (request) => Promise.resolve(server.fetch(request)) },
        { era, url: 'http://localhost/composed/mcp' },
      )
      const { tools } = await composed.listTools()
      expect(tools.map((tool) => tool.name)).toEqual(['inherited', 'message', 'generated'])
      expect(tools.find((tool) => tool.name === 'message')?._meta).toEqual({
        'fixture/custom': true,
      })
      expect(textOf(await composed.callTool({ name: 'message' }))).toBe('app')
      expect(textOf(await composed.callTool({ name: 'inherited' }))).toBe('inherited')
      expect(textOf(await composed.callTool({ name: 'generated' }))).toBe('generated')
      expect(textOf(await composed.readResource({ uri: 'docs://included' }))).toBe(
        'Included resource',
      )
      expect(textOf(await composed.getPrompt({ name: 'included-prompt' }))).toBe('Included prompt')
      expect(composed.getServerCapabilities()?.logging).toEqual({})
      expect(composed.getServerCapabilities()?.extensions).toEqual(
        era === 'modern'
          ? {
              'fixture/app': { enabled: true },
              'fixture/generated': { enabled: true },
            }
          : undefined,
      )
    },
  )

  it('enforces the configured request body limit', async () => {
    const response = await server.fetch(
      new Request('http://localhost/composed/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'message', arguments: { padding: 'x'.repeat(9000) } },
        }),
      }),
    )
    expect(response.status).toBe(413)
  })

  it('calls a discovered tool, with the Nitro event in scope', async () => {
    const result = await client.callTool({
      name: 'greet-visitor',
      arguments: { name: 'Ada' },
    })

    expect(textOf(result)).toBe('Hello Ada from /mcp')
  })

  it('registers definitions from a subdirectory too, grouped by it', async () => {
    await expect(client.callTool({ name: 'deep' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'from a subdirectory' }],
    })

    const { tools } = await client.listTools()

    expect(tools.find(({ name }) => name === 'deep')?._meta).toEqual({
      group: 'nested',
      tags: ['nested-tag'],
    })
  })

  it('serves the discovered resource and prompt', async () => {
    await expect(client.readResource({ uri: 'docs://readme' })).resolves.toMatchObject({
      contents: [{ uri: 'docs://readme', text: 'Fixture readme' }],
    })
    await expect(client.getPrompt({ name: 'review' })).resolves.toMatchObject({
      messages: [{ role: 'user', content: { type: 'text', text: 'Review this fixture.' } }],
    })
  })

  it('keeps the second server on its own definitions', async () => {
    const { tools } = await adminClient.listTools()

    expect(tools.map(({ name }) => name)).toEqual(['purge'])
    expect(adminClient.getServerVersion()?.name).toBe('admin-fixture')
    await expect(adminClient.callTool({ name: 'greet-visitor' })).rejects.toThrow(/Tool not found/)
  })

  // The admin directory holds a plugins.ts; the endpoint advertising its
  // extension is what proves the built app installed it, not merely imported it.
  it('installs the plugins file of the directory it scanned', () => {
    expect(adminClient.getServerCapabilities()?.extensions).toEqual({
      'fixture/stamp': { stamped: true },
    })
  })

  it('fires mcp:tool:called for tool calls on every endpoint', async () => {
    await client.callTool({ name: 'deep' })
    await adminClient.callTool({ name: 'purge' })

    const response = await server.fetch(new Request('http://localhost/tool-calls'))
    const calls = (await response.json()) as { name: string; path: string }[]

    expect(calls.slice(-2)).toEqual([
      { name: 'deep', path: '/mcp' },
      { name: 'purge', path: '/admin/mcp' },
    ])
  })

  it('leaves a server without a plugins file advertising no extension', () => {
    expect(client.getServerCapabilities()?.extensions).toBeUndefined()
  })
})
