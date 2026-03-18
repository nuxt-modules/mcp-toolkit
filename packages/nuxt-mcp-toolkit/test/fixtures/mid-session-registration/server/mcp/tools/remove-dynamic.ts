import { z } from 'zod'
import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpServer } from '../../../../../../src/runtime/server/mcp/server'

export default defineMcpTool({
  name: 'remove_dynamic',
  description: 'Removes a previously registered dynamic tool via useMcpServer()',
  inputSchema: {
    toolName: z.string().describe('Name of the tool to remove'),
  },
  handler: async ({ toolName }) => {
    const mcp = useMcpServer()
    const removed = mcp.removeTool(toolName)
    return {
      content: [{ type: 'text', text: removed ? `removed ${toolName}` : `not found: ${toolName}` }],
    }
  },
})
