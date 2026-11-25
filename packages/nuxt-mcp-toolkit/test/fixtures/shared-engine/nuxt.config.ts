import Mcp from '../../../src/module'

export default defineNuxtConfig({
  extends: ['./layer'],
  modules: [[Mcp, {
    name: 'shared-engine-fixture',
    servers: {
      default: { route: '/mcp' },
      admin: { route: '/admin/mcp', dir: 'mcp-admin' },
      runtime: { route: '/runtime/mcp', dir: 'mcp-runtime' },
    },
  }]],
  runtimeConfig: { mcpAdminToken: 'demo-token', mcpRuntimeToken: 'member-token' },
})
