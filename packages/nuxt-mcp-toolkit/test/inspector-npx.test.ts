import { describe, expect, it } from 'vitest'
import { inspectorMcpUrl, inspectorNpxSpec } from '../src/runtime/server/mcp/devtools'

const NPMJS = 'https://registry.npmjs.org'

describe('inspectorNpxSpec', () => {
  it('fetches the inspector from npmjs.org by default', () => {
    const spec = inspectorNpxSpec('http://localhost:3000/mcp', { PATH: '/usr/bin' })

    expect(spec.command).toBe('npx')
    expect(spec.args).toEqual([
      '--registry',
      NPMJS,
      '-y',
      '@modelcontextprotocol/inspector',
      '--transport',
      'http',
      '--server-url',
      'http://localhost:3000/mcp',
    ])
    expect(spec.env.npm_config_registry).toBe(NPMJS)
    expect(spec.env.NPM_CONFIG_REGISTRY).toBe(NPMJS)
  })

  it('ignores an inherited npm_config_registry (private npmrc must not 401 the download)', () => {
    const spec = inspectorNpxSpec('http://localhost:3000/mcp', {
      npm_config_registry: 'https://registry.k8s.vercel-security.com/npm/',
      NPM_CONFIG_REGISTRY: 'https://registry.k8s.vercel-security.com/npm/',
    })

    expect(spec.args[1]).toBe(NPMJS)
    expect(spec.env.npm_config_registry).toBe(NPMJS)
    expect(spec.env.NPM_CONFIG_REGISTRY).toBe(NPMJS)
  })

  it('uses MCP_INSPECTOR_REGISTRY when set', () => {
    const mirror = 'https://npm.example.internal'
    const spec = inspectorNpxSpec('http://localhost:3000/mcp', {
      MCP_INSPECTOR_REGISTRY: mirror,
      npm_config_registry: 'https://registry.k8s.vercel-security.com/npm/',
    })

    expect(spec.args[1]).toBe(mirror)
    expect(spec.env.npm_config_registry).toBe(mirror)
    expect(spec.env.NPM_CONFIG_REGISTRY).toBe(mirror)
  })
})

describe('inspectorMcpUrl', () => {
  it('rewrites IPv6 and IPv4 loopback to localhost', () => {
    expect(inspectorMcpUrl('http://[::1]:3000/', '/mcp', false, 3000)).toBe('http://localhost:3000/mcp')
    expect(inspectorMcpUrl('http://127.0.0.1:3000/', '/mcp', false, 3000)).toBe('http://localhost:3000/mcp')
  })

  it('keeps an existing localhost origin', () => {
    expect(inspectorMcpUrl('http://localhost:3000/', '/mcp', false, 3000)).toBe('http://localhost:3000/mcp')
  })

  it('falls back to localhost when Nuxt has no devServer.url', () => {
    expect(inspectorMcpUrl(undefined, '/mcp', false, 3000)).toBe('http://localhost:3000/mcp')
  })

  it('does not rewrite a non-loopback host', () => {
    expect(inspectorMcpUrl('http://example.test:3000/', '/mcp', false, 3000)).toBe('http://example.test:3000/mcp')
  })
})
