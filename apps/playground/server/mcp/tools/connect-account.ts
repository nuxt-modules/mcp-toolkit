import { z } from 'zod'

export default defineMcpTool({
  name: 'connect_account',
  description: 'Open a demo account connection URL.',
  inputSchema: z.object({ provider: z.enum(['github', 'google', 'gitlab']).default('github') }),
  handler: ({ provider }, event) => {
    const url = `https://example.com/oauth/${provider}/start`
    const request = mcpElicitUrl({ message: `Authorize the ${provider} integration`, url })
    if (!canRequestInput(event, request)) return `Open ${url} to connect your account.`
    if (getInputResponses(event, { connect: request }).connect) return 'The account connection flow was completed.'
    return inputRequired(event, { inputRequests: { connect: request } })
  },
})
