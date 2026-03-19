import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { z } from 'zod'
import { createError } from 'h3'

export default defineMcpTool({
  name: 'error_tool',
  description: 'A tool that throws errors for testing',
  inputSchema: {
    mode: z.enum(['h3', 'h3-data', 'plain']).describe('Error mode'),
  },
  handler: async ({ mode }) => {
    if (mode === 'h3') {
      throw createError({ statusCode: 404, message: 'User not found' })
    }
    if (mode === 'h3-data') {
      throw createError({ statusCode: 400, message: 'Validation failed', data: { fields: ['name', 'email'] } })
    }
    throw new Error('Something went wrong')
  },
})
