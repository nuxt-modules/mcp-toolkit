import { z } from 'zod'

export default defineMcpTool({
  description: 'Retrieves the full markdown content of a specific documentation page by path',
  inputSchema: {
    path: z.string().describe('The page path (e.g., /getting-started/installation)'),
  },
  handler: async (params) => {
    const result = await $fetch('/api/.mcp/get-page', { query: params })
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  },
})
