import { fileURLToPath } from 'node:url'
import mcp from '../../src/module/index.ts'

/** A Nitro app with two MCP servers: the default one, and an admin one. */
export const fixtureDir = fileURLToPath(new URL('../fixtures/discovery', import.meta.url))

export const modules = [
  mcp({ name: 'discovery-fixture', version: '1.0.0' }),
  mcp({ route: '/admin/mcp', dir: 'server/mcp-admin', name: 'admin-fixture', version: '1.0.0' }),
]
