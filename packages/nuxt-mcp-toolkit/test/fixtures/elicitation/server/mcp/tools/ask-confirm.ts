import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpElicitation, McpElicitationError } from '../../../../../../src/runtime/server/mcp/elicitation'

export default defineMcpTool({
  name: 'ask_confirm',
  description: 'Ask the user to confirm an action',
  inputSchema: {},
  handler: async () => {
    const elicit = useMcpElicitation()

    try {
      const ok = await elicit.confirm('Continue?')
      return { content: [{ type: 'text', text: ok ? 'yes' : 'no' }] }
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
