import { defineMcpTool } from '../../../../../../src/runtime/server/types'

// explicit name overrides auto-generation
export default defineMcpTool({
  name: 'custom-name',
  description: 'Tool with custom name',
  inputSchema: {},
  handler: async () => {
    return {
      content: [{
        type: 'text',
        text: 'Custom name tool',
      }],
    }
  },
})
