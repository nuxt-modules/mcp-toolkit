import { describe, it, expect, vi } from 'vitest'

vi.mock('nitropack/runtime', () => ({
  defineCachedFunction: <T>(fn: T) => fn,
}))

const { createCacheOptions } = await import(
  '../src/runtime/server/mcp/definitions/cache'
)

describe('createCacheOptions', () => {
  it('defaults swr to false to keep handlers inside the request lifetime', () => {
    expect(createCacheOptions('1h', 'mcp-tool:get-page').swr).toBe(false)
    expect(createCacheOptions({ maxAge: '1h' }, 'mcp-tool:get-page').swr).toBe(false)
  })

  it('respects explicit swr opt-in', () => {
    expect(createCacheOptions({ maxAge: '1h', swr: true }, 'mcp-tool:get-page').swr).toBe(true)
  })
})
