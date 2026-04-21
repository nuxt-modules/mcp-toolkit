import { z } from 'zod'

export default defineMcpTool({
  name: 'connect_account',
  description: 'Demo URL-mode elicitation: redirect the user to an external auth page',
  inputSchema: {
    provider: z.enum(['github', 'google', 'gitlab']).default('github').describe('Provider to connect'),
  },
  handler: async ({ provider }) => {
    const elicit = useMcpElicitation()

    if (!elicit.supports('url')) {
      return `Open https://example.com/oauth/${provider} to connect, then try again. (Client did not declare elicitation.url.)`
    }

    const result = await elicit.url({
      message: `Authorize the ${provider} integration`,
      url: `https://example.com/oauth/${provider}/start`,
    })

    return result.action === 'accept'
      ? `${provider} connected.`
      : `User did not complete the ${provider} flow (${result.action}).`
  },
})
