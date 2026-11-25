import Mcp from '../../../src/module'

export default defineNuxtConfig({
  extends: ['./layer'],
  modules: [[Mcp, {
    name: 'shared-engine-fixture',
    servers: {
      default: { route: '/mcp' },
      admin: { route: '/admin/mcp', dir: 'mcp-admin', auth: { tokens: ['demo-token'] } },
    },
  }]],
})
