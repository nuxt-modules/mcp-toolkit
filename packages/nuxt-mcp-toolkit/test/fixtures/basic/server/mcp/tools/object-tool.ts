import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'object_tool',
  description: 'A tool that returns a plain object',
  inputSchema: {
    id: z.string().describe('User ID'),
  },
  handler: async ({ id }) => ({ id, name: 'Nuxt', stars: 55000 }),
})
