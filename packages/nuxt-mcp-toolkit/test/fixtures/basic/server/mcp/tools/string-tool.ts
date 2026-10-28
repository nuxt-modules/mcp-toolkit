import { defineMcpTool } from '../../../../../../src/runtime/server/index'
import { z } from 'zod'

export default defineMcpTool({
  name: 'string_tool',
  description: 'A tool that returns a plain string',
  inputSchema: z.object({
    name: z.string().describe('Name to greet'),
  }),
  handler: async ({ name }) => `Hello ${name}`,
})
