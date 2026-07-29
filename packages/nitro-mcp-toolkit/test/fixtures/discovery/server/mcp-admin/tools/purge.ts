import { defineMcpTool } from 'nitro-mcp-toolkit'

// Only the second server serves this one.
export default defineMcpTool({
  handler: () => 'purged',
})
