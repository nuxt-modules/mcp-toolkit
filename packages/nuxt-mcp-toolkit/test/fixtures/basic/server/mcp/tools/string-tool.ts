import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'string_tool',
  description: 'A tool that returns a plain string',
  inputSchema: {
    name: z.string().describe('Name to greet'),
  },
  handler: async ({ name }) => `Hello ${name}`,
})
