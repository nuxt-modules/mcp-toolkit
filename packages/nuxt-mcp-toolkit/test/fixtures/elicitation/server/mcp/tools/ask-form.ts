import { z } from 'zod'
import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpElicitation, McpElicitationError } from '../../../../../../src/runtime/server/mcp/elicitation'

export default defineMcpTool({
  name: 'ask_form',
  description: 'Ask the user for a name and channel via form-mode elicitation',
  inputSchema: {},
  handler: async () => {
    const elicit = useMcpElicitation()

    try {
      const result = await elicit.form({
        message: 'Please provide your details',
        schema: {
          name: z.string().describe('Your name'),
          channel: z.enum(['stable', 'beta']).describe('Release channel'),
        },
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
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
