import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build, createNitro } from 'nitro/builder'
import { afterEach, describe, expect, it } from 'vitest'
import type { Nitro } from 'nitro/types'

const fixtureDir = fileURLToPath(new URL('./fixtures/basic', import.meta.url))

interface StandardServerEntry {
  fetch: (request: Request) => Response | Promise<Response>
}

describe('nitroMcpToolkit', () => {
  let nitro: Nitro | undefined

  afterEach(async () => {
    await nitro?.close()
    nitro = undefined
    await rm(new URL('./fixtures/basic/.output', import.meta.url), { recursive: true, force: true })
  })

  it('boots a Nitro app with the module registered and serves its route', async () => {
    // `standard` preset exports a bare `{ fetch }` with no listening socket
    nitro = await createNitro({ rootDir: fixtureDir, dev: false, preset: 'standard' })
    await build(nitro)

    const entry = `${nitro.options.output.serverDir}/index.mjs`
    const { default: server } = await import(/* @vite-ignore */ entry) as { default: StandardServerEntry }

    const response = await server.fetch(new Request('http://localhost/mcp'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      toolkit: 'nitro-mcp-toolkit',
      status: 'ok',
    })
  })
})
