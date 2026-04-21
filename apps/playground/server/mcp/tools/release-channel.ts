import { z } from 'zod'

export default defineMcpTool({
  name: 'release_channel',
  description: 'Demo elicitation: ask the user which release channel to publish to',
  inputSchema: {
    name: z.string().describe('Release name'),
  },
  handler: async ({ name }) => {
    const elicit = useMcpElicitation()

    if (!elicit.supports('form')) {
      return `Use a client that supports elicitation to publish "${name}".`
    }

    const result = await elicit.form({
      message: `Pick a release channel for "${name}"`,
      schema: {
        channel: z.enum(['stable', 'beta', 'canary']).describe('Release channel'),
        notify: z.boolean().default(true).describe('Notify subscribers'),
      },
    })

    if (result.action !== 'accept') {
      return `Release "${name}" cancelled (${result.action}).`
    }

    return `Released "${name}" on ${result.content.channel} (notify=${result.content.notify}).`
  },
})
