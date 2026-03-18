import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpSession } from '../../../../../../src/runtime/server/mcp/session'
import { z } from 'zod'

interface TestSession {
  [key: string]: string
}

export default defineMcpTool({
  name: 'get_value',
  description: 'Retrieves a value by key from the session-scoped store',
  inputSchema: {
    key: z.string(),
  },
  handler: async ({ key }) => {
    const session = useMcpSession<TestSession>()
    const value = await session.get(key)
    return {
      content: [{ type: 'text', text: value ?? 'NOT_FOUND' }],
    }
  },
})
