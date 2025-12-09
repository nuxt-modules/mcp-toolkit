import { z } from 'zod'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default defineMcpTool({
  description: 'Echo back a message after 1 second delay',
  inputSchema: {
    message: z.string().describe('The message to echo'),
  },
  handler: async ({ message }) => {
    // cloudflare MCP would only break when there was an async response
    await sleep(1000)
    return textResult(`Echo: ${message}`)
  },
})
