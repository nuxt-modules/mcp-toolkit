import { defineMcpTool } from '../../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  group: 'custom-override',
  tags: ['override'],
  description: 'Tool in admin/ subdirectory but with explicit group override',
  handler: async () => 'overridden group',
})
