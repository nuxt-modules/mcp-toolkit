import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

/**
 * Lives in the second server, one directory deep: its name comes from the
 * filename and its group from the `cache/` folder around it.
 */
export default defineMcpTool({
  description: 'Drop cached entries, or all of them',
  annotations: { destructiveHint: true },
  inputSchema: z.object({
    prefix: z.string().default('').describe('Only purge keys starting with this'),
  }),
  handler: ({ prefix }) => `Purged ${prefix === '' ? 'everything' : `${prefix}*`}.`,
})
