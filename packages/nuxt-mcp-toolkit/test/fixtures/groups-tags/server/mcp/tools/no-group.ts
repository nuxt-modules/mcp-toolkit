import { defineMcpTool } from '../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  description: 'A tool with no group or tags',
  handler: async () => 'no group',
})
