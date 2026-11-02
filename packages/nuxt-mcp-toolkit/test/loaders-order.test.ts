import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadAllDefinitions } from '../src/runtime/server/mcp/loaders'

const state = vi.hoisted(() => ({ registered: [] as string[], slowKind: '' }))

vi.mock('@nuxt/kit', () => ({
  addServerTemplate: (template: { filename: string }) => {
    state.registered.push(template.filename)
  },
  getLayerDirectories: () => [
    { server: fileURLToPath(new URL('./fixtures/basic/server/', import.meta.url)) },
  ],
  logger: { withTag: () => ({ warn: vi.fn(), error: vi.fn() }) },
}))

vi.mock('tinyglobby', async (importOriginal) => {
  const actual = await importOriginal<typeof import('tinyglobby')>()
  return {
    ...actual,
    glob: async (...args: Parameters<typeof actual.glob>) => {
      if (String(args[0]).includes(`/mcp/${state.slowKind}/`)) {
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      return actual.glob(...args)
    },
  }
})

describe('loadAllDefinitions', () => {
  beforeEach(() => {
    state.registered.length = 0
  })

  it.each(['tools', 'resources', 'prompts'])('registers templates in a fixed order when the %s scan is slow', async (kind) => {
    state.slowKind = kind
    await loadAllDefinitions({
      tools: ['mcp/tools'],
      resources: ['mcp/resources'],
      prompts: ['mcp/prompts'],
      handlers: ['mcp'],
    })
    expect(state.registered).toEqual([
      '#nuxt-mcp-toolkit/tools.mjs',
      '#nuxt-mcp-toolkit/resources.mjs',
      '#nuxt-mcp-toolkit/prompts.mjs',
      '#nuxt-mcp-toolkit/handlers.mjs',
      '#nuxt-mcp-toolkit/default-handler.mjs',
    ])
  })
})
