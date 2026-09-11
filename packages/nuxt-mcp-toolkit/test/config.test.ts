import { describe, expect, it } from 'vitest'
import { defaultMcpConfig, getMcpConfig } from '../src/runtime/server/mcp/config'

describe('MCP runtime config', () => {
  it('excludes DevTools inspector options', () => {
    expect(defaultMcpConfig).not.toHaveProperty('inspector')
    expect(getMcpConfig()).not.toHaveProperty('inspector')
  })
})
