import { defineMcpTool } from '../../../../../../src/runtime/server/types'

export default defineMcpTool({
  name: 'failing_tool',
  description: 'A tool whose handler always throws',
  inputSchema: {},
  handler: async () => {
    throw new Error('failing-tool failed')
  },
})
