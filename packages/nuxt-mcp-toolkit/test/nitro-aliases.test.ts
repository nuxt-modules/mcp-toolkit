import { describe, expect, it } from 'vitest'
import type { Nuxt } from '@nuxt/schema'
import type { NitroConfig } from 'nitropack'
import { setupNitroAliases } from '../src/setup/nitro-aliases'

function runNitroConfig(nitroMajor: 2 | 3): NitroConfig {
  let hook: ((config: NitroConfig) => void) | undefined
  const nuxt = {
    options: { dev: false, _nitroMajor: nitroMajor },
    hook: (name: string, fn: (config: NitroConfig) => void) => {
      if (name === 'nitro:config') hook = fn
    },
  } as unknown as Nuxt
  setupNitroAliases(nuxt, { resolve: (path: string) => path } as never)
  const config: NitroConfig = {}
  hook!(config)
  return config
}

describe('setupNitroAliases', () => {
  it('points h3 at the h3 v1 of nitropack on Nitro 2', () => {
    expect(runNitroConfig(2).alias?.h3).toMatch(/[\\/]h3[\\/]/)
  })

  it('keeps h3 unaliased on Nitro 3', () => {
    expect(runNitroConfig(3).alias?.h3).toBeUndefined()
  })
})
