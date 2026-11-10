import Mcp from '../../../src/module'

export default defineNuxtConfig({
  extends: ['./layer'],
  modules: [[Mcp, {
    name: 'shared-engine-fixture',
    servers: {
      default: { route: '/mcp' },
      admin: { route: '/admin/mcp', dir: 'mcp-admin', auth: '~~/server/mcp-admin/auth.ts' },
    },
  }]],
  runtimeConfig: { mcpAdminToken: 'demo-token' },
})
