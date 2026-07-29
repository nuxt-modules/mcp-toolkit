import { createNitro } from 'nitro/builder'
import { afterEach, describe, expect, it } from 'vitest'
import type { Nitro } from 'nitro/types'
import { nitroMcpToolkit } from '../src/module'

// `createNitro` alone (without `build`) already runs module `setup()` and
// stays cheap, so wiring can be asserted without a full bundle per test.
describe('nitroMcpToolkit', () => {
  let nitro: Nitro | undefined

  afterEach(async () => {
    await nitro?.close()
    nitro = undefined
  })

  it('registers a handler on the default route', async () => {
    nitro = await createNitro({ rootDir: process.cwd(), dev: false, modules: [nitroMcpToolkit()] })

    expect(nitro.options.handlers).toContainEqual(expect.objectContaining({ route: '/mcp' }))
  })

  it('registers a handler on a custom route', async () => {
    nitro = await createNitro({
      rootDir: process.cwd(),
      dev: false,
      modules: [nitroMcpToolkit({ route: '/custom-mcp' })],
    })

    expect(nitro.options.handlers).toContainEqual(expect.objectContaining({ route: '/custom-mcp' }))
  })
})
