import { z } from 'zod'
import { defineMcpTool } from '../../../../../../src/runtime/server/index'

// name and title are auto-generated from filename
export default defineMcpTool({
  description: 'List all documentation files',
  inputSchema: z.object({}),
  handler: async () => {
    return {
      content: [{
        type: 'text',
        text: 'Documentation list',
      }],
    }
  },
})
