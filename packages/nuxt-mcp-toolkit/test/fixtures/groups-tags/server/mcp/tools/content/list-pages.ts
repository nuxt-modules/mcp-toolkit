import { defineMcpTool } from '../../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  description: 'List all content pages',
  tags: ['readonly'],
  handler: async () => ['page-1', 'page-2', 'page-3'],
})
