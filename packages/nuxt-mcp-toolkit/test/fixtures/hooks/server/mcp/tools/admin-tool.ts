import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'admin_tool',
  description: 'An admin tool filtered out by mcp:config:resolved',
  tags: ['admin'],
  inputSchema: {},
  handler: async () => 'admin-result',
})
