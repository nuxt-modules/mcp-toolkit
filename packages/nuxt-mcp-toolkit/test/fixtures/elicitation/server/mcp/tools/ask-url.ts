import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpElicitation, McpElicitationError } from '../../../../../../src/runtime/server/mcp/elicitation'

export default defineMcpTool({
  name: 'ask_url',
  description: 'Open a URL via URL-mode elicitation',
  inputSchema: {},
  handler: async () => {
    const elicit = useMcpElicitation()

    try {
      const result = await elicit.url({
        message: 'Open the verification page',
        url: 'https://example.com/verify',
      })

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      }
    }
    catch (err) {
      if (err instanceof McpElicitationError) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: err.code }) }],
        }
      }
      throw err
    }
  },
})
