import { defineMcpTool } from '../../../../../../src/runtime/server/types'

// name and title are auto-generated from filename
export default defineMcpTool({
  description: 'List all documentation files',
  inputSchema: {},
  handler: async () => {
    return {
      content: [{
        type: 'text',
        text: 'Documentation list',
      }],
    }
  },
})
