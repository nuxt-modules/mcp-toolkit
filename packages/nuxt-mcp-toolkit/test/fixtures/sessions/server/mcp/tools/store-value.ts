import { defineMcpTool } from '../../../../../../src/runtime/server/types'
import { useMcpSession } from '../../../../../../src/runtime/server/mcp/session'
import { z } from 'zod'

interface TestSession {
  [key: string]: string
}

export default defineMcpTool({
  name: 'store_value',
  description: 'Stores a key-value pair in the session-scoped store',
  inputSchema: {
    key: z.string(),
    value: z.string(),
  },
  handler: async ({ key, value }) => {
    const session = useMcpSession<TestSession>()
    await session.set(key, value)
    return {
      content: [{ type: 'text', text: `Stored: ${key}=${value}` }],
    }
  },
})
