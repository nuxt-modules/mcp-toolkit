import { defineMcpTool } from 'nitro-mcp-toolkit'

// One directory down: still registered, and its group comes from the folder.
export default defineMcpTool({
  handler: () => 'from a subdirectory',
})
