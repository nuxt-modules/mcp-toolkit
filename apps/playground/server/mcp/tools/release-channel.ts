import { z } from 'zod'

const requests = {
  channel: mcpElicit({
    message: 'Pick a release channel',
    requestedSchema: {
      type: 'object',
      properties: { channel: { type: 'string', enum: ['stable', 'beta', 'canary'] } },
      required: ['channel'],
    },
  }),
}
const channelSchema = z.enum(['stable', 'beta', 'canary'])

export default defineMcpTool({
  name: 'release_channel',
  description: 'Choose a release channel. Clients without elicitation can pass channel directly.',
  inputSchema: z.object({ name: z.string(), channel: channelSchema.optional() }),
  handler: ({ name, channel }, event) => {
    const submitted = getElicitedContent(event, requests, 'channel')?.channel
    if (channel || submitted) return `Prepared ${name} on ${channelSchema.parse(channel ?? submitted)}.`
    if (!canRequestInput(event, requests.channel)) return 'Pass channel as stable, beta, or canary.'
    return inputRequired(event, { inputRequests: getMissingInputs(event, requests) })
  },
})
