import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'

export default defineMcpTool({
  name: 'number_tool',
  description: 'A tool that returns a plain number',
  inputSchema: {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  },
  handler: async ({ a, b }) => a + b,
})
