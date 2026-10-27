import { defineMcpTool } from 'nitro-mcp-toolkit'

export default defineMcpTool({
  _meta: { 'fixture/custom': true },
  handler: () => 'app',
})
