import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

/**
 * Lives in the second server, one directory deep: its name comes from the
 * filename and its group from the `cache/` folder around it.
 *
 * Also exercises `event.context.mcp.notify`, the same object as
 * `handler.notify` without importing the generated handler this tool is
 * already registered on.
 */
export default defineMcpTool({
  description: 'Drop cached entries, or all of them',
  tags: ['destructive', 'admin'],
  annotations: { destructiveHint: true },
  inputSchema: z.object({
    prefix: z.string().default('').describe('Only purge keys starting with this'),
  }),
  handler: ({ prefix }, event) => {
    event.context.mcp.notify.resourcesChanged()
    return `Purged ${prefix === '' ? 'everything' : `${prefix}*`}.`
  },
})
