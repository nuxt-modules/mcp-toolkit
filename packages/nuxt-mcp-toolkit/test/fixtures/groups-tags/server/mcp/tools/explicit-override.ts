import { defineMcpTool } from '../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  group: 'custom-group',
  tags: ['special'],
  description: 'Tool with explicit group from root directory',
  handler: async () => 'explicit group',
})
