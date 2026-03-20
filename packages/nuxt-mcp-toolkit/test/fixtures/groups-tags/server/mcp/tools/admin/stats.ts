import { defineMcpTool } from '../../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  description: 'Get admin statistics',
  tags: ['readonly'],
  annotations: { readOnlyHint: true },
  handler: async () => ({ users: 42, active: 38 }),
})
