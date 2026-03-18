import { z } from 'zod'
import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpServer } from '../../../../../../src/runtime/server/mcp/server'

export default defineMcpTool({
  name: 'register_dynamic',
  description: 'Registers a new tool mid-session via useMcpServer()',
  inputSchema: {
    toolName: z.string().describe('Name for the dynamic tool'),
  },
  handler: async ({ toolName }) => {
    const mcp = useMcpServer()
    mcp.registerTool(toolName, {
      description: `Dynamically registered: ${toolName}`,
    }, async () => ({
      content: [{ type: 'text', text: `hello from ${toolName}` }],
    }))
    return {
      content: [{ type: 'text', text: `registered ${toolName}` }],
    }
  },
})
