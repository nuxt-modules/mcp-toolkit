import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpElicitation } from '../../../../../../src/runtime/server/mcp/elicitation'

export default defineMcpTool({
  name: 'supports_check',
  description: 'Returns which elicitation modes the connected client supports',
  inputSchema: {},
  handler: async () => {
    const elicit = useMcpElicitation()
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            form: elicit.supports('form'),
            url: elicit.supports('url'),
          }),
        },
      ],
    }
  },
})
