import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'base_tool',
  description: 'A tool that is always registered',
  inputSchema: {},
  handler: async () => ({
    content: [{ type: 'text', text: 'base' }],
  }),
})
