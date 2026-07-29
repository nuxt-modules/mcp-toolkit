import { defineMcpTool } from 'nitro-mcp-toolkit'

// A file that names itself keeps that name, whatever it is called on disk.
export default defineMcpTool({
  name: 'explicitly-named',
  title: 'Explicitly Named',
  handler: () => 'named by hand',
})
