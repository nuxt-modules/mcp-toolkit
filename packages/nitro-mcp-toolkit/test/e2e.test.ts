import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, createNitro } from 'nitro/builder'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createMcpTestClient } from '../src/testing'
import type { Nitro } from 'nitro/types'
import type { Client } from '@modelcontextprotocol/client'

const fixtureDir = fileURLToPath(new URL('./fixtures/basic', import.meta.url))

interface StandardServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

// Proves the core survives a real Nitro build: bundling, the `standard` preset's
// fetch entry, and file-based routing. Everything else is covered by the unit
// tests, which import from `src` and run in milliseconds.
describe('inside a built Nitro app', () => {
  let nitro: Nitro
  let client: Client

  beforeAll(async () => {
    // The `standard` preset exports a bare `{ fetch }` and listens on no socket.
    nitro = await createNitro({ rootDir: fixtureDir, dev: false, preset: 'standard' })
    await build(nitro)

    const { default: server } = (await import(
      /* @vite-ignore */ `${nitro.options.output.serverDir}/index.mjs`
    )) as { default: StandardServerEntry }

    client = await createMcpTestClient({
      fetch: (request) => Promise.resolve(server.fetch(request)),
    })
  })

  afterAll(async () => {
    await client.close()
    await nitro.close()
    await rm(new URL('./fixtures/basic/.output', import.meta.url), { recursive: true, force: true })
  })

  it('serves the tool the route registered, with the Nitro event in scope', async () => {
    const result = await client.callTool({ name: 'greet', arguments: { name: 'Ada' } })

    expect(result.content).toEqual([{ type: 'text', text: 'Hello Ada from /mcp' }])
  })

  it('serves the route resource and prompt', async () => {
    await expect(client.readResource({ uri: 'docs://readme' })).resolves.toMatchObject({
      contents: [{ uri: 'docs://readme', text: 'Fixture readme' }],
    })
    await expect(client.getPrompt({ name: 'review' })).resolves.toMatchObject({
      messages: [{ role: 'user', content: { type: 'text', text: 'Review this fixture.' } }],
    })
  })
})
