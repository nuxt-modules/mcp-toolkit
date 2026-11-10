import { defineMcpServer } from 'nitro-mcp-toolkit'

export default defineMcpServer({
  name: 'nitro-mcp-playground-admin',
  version: '0.0.0',
  auth: {
    schemes: ['bearer'],
    validate: ({ token }) => token === (process.env.MCP_ADMIN_TOKEN ?? 'dev-admin-token'),
  },
})
