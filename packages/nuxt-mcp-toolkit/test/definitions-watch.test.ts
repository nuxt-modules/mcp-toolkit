import { describe, expect, it } from 'vitest'
import { buildDefaultPaths, needsRestart } from '../src/setup/definitions'

const servers = ['/project/server/', '/project/layers/base/server/']
const paths = buildDefaultPaths('mcp')

describe('needsRestart', () => {
  it('restarts when a definition file or directory is added or removed in any layer', () => {
    expect(needsRestart('unlink', '/project/server/mcp/resources/current-user.ts', servers, paths)).toBe(true)
    expect(needsRestart('add', '/project/layers/base/server/mcp/tools/echo.ts', servers, paths)).toBe(true)
    expect(needsRestart('addDir', '/project/server/mcp/prompts', servers, paths)).toBe(true)
  })

  it('leaves edits and files outside the definition dirs to HMR', () => {
    expect(needsRestart('change', '/project/server/mcp/tools/echo.ts', servers, paths)).toBe(false)
    expect(needsRestart('add', '/project/server/api/health.get.ts', servers, paths)).toBe(false)
    expect(needsRestart('add', '/project/server/mcp-other/tool.ts', servers, paths)).toBe(false)
  })
})
