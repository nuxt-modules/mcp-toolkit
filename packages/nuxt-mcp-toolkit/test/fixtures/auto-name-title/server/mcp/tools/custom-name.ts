import { defineMcpTool } from '../../../../../../src/runtime/server/index'

// explicit name overrides auto-generation
export default defineMcpTool({
  name: 'custom-name',
  description: 'Tool with custom name',
  handler: async () => {
    return {
      content: [{
        type: 'text',
        text: 'Custom name tool',
      }],
    }
  },
})
