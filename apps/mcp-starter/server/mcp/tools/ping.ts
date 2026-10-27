import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  name: 'ping',
  description: 'Health check — returns pong with an optional message.',
  inputSchema: z.object({
    message: z.string().optional().describe('Optional text to echo back'),
  }),
  handler: async ({ message }) => {
    return message ? `pong: ${message}` : 'pong'
  },
})
