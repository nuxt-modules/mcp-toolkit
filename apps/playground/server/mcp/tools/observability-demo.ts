import { z } from 'zod'

export default defineMcpTool({
  name: 'observability_demo',
  description: 'Send request-scoped MCP log messages when the client asks for them.',
  inputSchema: z.object({ label: z.string() }),
  handler: ({ label }, event) => {
    event.context.mcp.log?.('info', { message: 'Demo started', label }, 'demo')
    event.context.mcp.log?.('warning', { message: 'A sample warning', label }, 'demo')
    return `Sent the requested log messages for ${label}.`
  },
})
