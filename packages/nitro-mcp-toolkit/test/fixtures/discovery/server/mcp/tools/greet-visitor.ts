import { defineMcpTool } from 'nitro-mcp-toolkit'
import { z } from 'zod'

// Names itself after nothing: the filename is the name and the title.
export default defineMcpTool({
  inputSchema: z.object({ name: z.string() }),
  handler: ({ name }, ctx) => `Hello ${name} from ${ctx.event.url.pathname}`,
})
