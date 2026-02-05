import { defineMcpTool, textResult } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  description: 'A simple greeting tool',
  inputSchema: {
    name: z.string().describe('The name to greet'),
  },
  handler: async ({ name }) => {
    return textResult(`Hello, ${name}! Welcome to Nitro MCP Toolkit.`)
  },
})
