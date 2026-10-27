import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpTool({
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string(), era: z.string() }),
  handler: ({ name }, event) => ({
    greeting: `Hello ${name} from ${event.context.user}`,
    era: String(event.context.mcp.era),
  }),
})
