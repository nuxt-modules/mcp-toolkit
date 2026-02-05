import { defineMcpTool, jsonResult } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  description: 'Get the current time in various formats',
  inputSchema: {
    timezone: z.string().optional().describe('Timezone (e.g., "America/New_York", "Europe/Paris")'),
    format: z.enum(['iso', 'unix', 'human']).default('iso').describe('Output format'),
  },
  handler: async ({ timezone, format }) => {
    const now = new Date()

    let timeString: string

    switch (format) {
      case 'unix':
        timeString = Math.floor(now.getTime() / 1000).toString()
        break
      case 'human':
        timeString = now.toLocaleString('en-US', {
          timeZone: timezone || 'UTC',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        break
      case 'iso':
      default:
        timeString = now.toISOString()
    }

    return jsonResult({
      format,
      timezone: timezone || 'UTC',
      time: timeString,
    })
  },
})
