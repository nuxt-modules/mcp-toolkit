import { defineMcpServer } from 'nitro-mcp-toolkit'
export default defineMcpServer({
  name: 'indexed-server',
  instructions: 'Index instructions',
  auth: { schemes: ['bearer'], validate: ({ token }) => token === 'index-token' },
})
