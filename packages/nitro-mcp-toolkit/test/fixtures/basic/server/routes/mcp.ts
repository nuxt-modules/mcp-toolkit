import {
  createMcpHandler,
  defineMcpPrompt,
  defineMcpResource,
  defineMcpTool,
} from 'nitro-mcp-toolkit'
import { z } from 'zod'

const greet = defineMcpTool({
  name: 'greet',
  description: 'Greet someone by name',
  inputSchema: z.object({ name: z.string() }),
  handler: ({ name }, ctx) => `Hello ${name} from ${ctx.event.url.pathname}`,
})

const readme = defineMcpResource({
  name: 'readme',
  uri: 'docs://readme',
  handler: () => 'Fixture readme',
})

const review = defineMcpPrompt({
  name: 'review',
  handler: () => 'Review this fixture.',
})

export default createMcpHandler({
  name: 'fixture',
  version: '1.0.0',
  tools: [greet],
  resources: [readme],
  prompts: [review],
})
