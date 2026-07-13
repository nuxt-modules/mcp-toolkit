import { describe, expect, it } from 'vitest'
import { stripTypeScriptFromMacroArg } from '../src/setup/mcp-apps/strip-typescript'

describe('stripTypeScriptFromMacroArg', () => {
  it('strips generic type arguments on $fetch calls (issue #279)', () => {
    const input = `{
  handler: async ({ base }) => {
    const swatches = await $fetch<{ name: string, hex: string }[]>('/api/palette', {
      query: { base },
    })
    return { structuredContent: { swatches } }
  },
}`

    const out = stripTypeScriptFromMacroArg(input)

    expect(out).not.toMatch(/\$fetch</)
    expect(out).toContain('$fetch("/api/palette"')
    expect(out).toContain('query: { base }')
  })

  it('strips arrow-function return type annotations', () => {
    const input = `{
  handler: async ({ base }): Promise<{ structuredContent: PalettePayload }> => ({
    structuredContent: await $fetch('/api/palette', { query: { base } }),
  }),
}`

    const out = stripTypeScriptFromMacroArg(input)

    expect(out).not.toMatch(/\): Promise</)
    expect(out).toContain('handler: async ({ base }) =>')
  })

  it('strips parameter type annotations', () => {
    const input = `{ handler: async (x: string, y: number) => x + y }`

    expect(stripTypeScriptFromMacroArg(input)).toContain('async (x, y) => x + y')
  })

  it('preserves comparison operators', () => {
    const input = `{ handler: async () => a < b && c > d }`

    expect(stripTypeScriptFromMacroArg(input)).toContain('a < b && c > d')
  })
})
