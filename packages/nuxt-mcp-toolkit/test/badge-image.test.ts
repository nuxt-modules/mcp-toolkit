import { describe, it, expect } from 'vitest'
import { hexColor } from '../src/runtime/server/mcp/badge-image'

describe('badge colors', () => {
  it('accepts hex colors without #', () => {
    for (const value of ['fff', 'FFFF', '171717', '17171780']) {
      expect(hexColor(value, '000')).toBe(value)
    }
  })

  it('falls back to the default for anything else', () => {
    for (const value of ['#fff', 'red', 'ff', '12345', 'fff"/><x y="', ['fff'], undefined]) {
      expect(hexColor(value, '000')).toBe('000')
    }
  })
})
