import { z } from 'zod'
import { defineMcpTool } from '../../../../../../src/runtime/server/mcp/definitions/tools'

export default defineMcpTool({
  group: 'search',
  tags: ['readonly', 'public'],
  description: 'Search public content',
  inputSchema: {
    query: z.string().describe('Search query'),
  },
  handler: async ({ query }) => `Results for: ${query}`,
})
