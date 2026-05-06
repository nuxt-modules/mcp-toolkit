import { describe, it, expect } from 'vitest'
import { inferAttribution, sfcToAppName } from '../src/setup/mcp-apps/discover'

describe('inferAttribution', () => {
  const root = '/proj/app/mcp'

  it('returns the first sub-directory between the apps root and the SFC', () => {
    expect(inferAttribution('/proj/app/mcp/finder/stay-finder.vue', root)).toBe('finder')
  })

  it('keeps only the first sub-directory level (deeper sub-folders ignored)', () => {
    expect(inferAttribution('/proj/app/mcp/finder/admin/audit-log.vue', root)).toBe('finder')
  })

  it('returns undefined for SFCs sitting directly under the apps root', () => {
    expect(inferAttribution('/proj/app/mcp/color-picker.vue', root)).toBeUndefined()
  })

  it('returns undefined for paths outside the apps root', () => {
    expect(inferAttribution('/elsewhere/foo.vue', root)).toBeUndefined()
  })
})

describe('sfcToAppName', () => {
  it('kebab-cases the basename', () => {
    expect(sfcToAppName('/proj/app/mcp/StayFinder.vue')).toBe('stay-finder')
    expect(sfcToAppName('/proj/app/mcp/color_picker.vue')).toBe('color-picker')
    expect(sfcToAppName('/proj/app/mcp/audit-log.vue')).toBe('audit-log')
  })

  it('only uses the basename (sub-folders do not affect the name)', () => {
    expect(sfcToAppName('/proj/app/mcp/finder/stay-finder.vue')).toBe('stay-finder')
  })
})
