import { rm } from 'node:fs/promises'
import { build, createNitro } from 'nitro/builder'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpTestClient, textOf } from '../src/testing/index.ts'
import { fixtureDir, modules } from './helpers/discovery-fixture.ts'
import type { Nitro } from 'nitro/types'
import type { Client } from '@modelcontextprotocol/client'

interface StandardServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

// The module is only worth anything if a file dropped in a directory is really
// served, so this goes through a full build rather than the module's own output.
describe('a built Nitro app using the module', () => {
  let nitro: Nitro
  let client: Client
  let adminClient: Client

  beforeAll(async () => {
    nitro = await createNitro({ rootDir: fixtureDir, dev: false, preset: 'standard', modules })
    await build(nitro)

    const { default: server } = (await import(
      /* @vite-ignore */ `${nitro.options.output.serverDir}/index.mjs`
    )) as { default: StandardServerEntry }

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
})
