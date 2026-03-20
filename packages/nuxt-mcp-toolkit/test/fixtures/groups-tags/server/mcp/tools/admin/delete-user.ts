import { z } from 'zod'
import { defineMcpTool } from '../../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  description: 'Delete a user account',
  tags: ['destructive', 'user-management'],
  inputSchema: {
    userId: z.string().describe('The user ID to delete'),
  },
  handler: async ({ userId }) => `Deleted user ${userId}`,
})
