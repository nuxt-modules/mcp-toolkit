import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'public_tool',
  description: 'A public tool always exposed by the server',
  inputSchema: {},
  handler: async () => 'public-result',
})
