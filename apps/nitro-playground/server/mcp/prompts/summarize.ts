import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

/** Exercises prompt arguments and a multi-message result. */
export default defineMcpPrompt({
  description: 'Summarize a piece of text to a target length',
  inputSchema: z.object({
    text: z.string().describe('The text to summarize'),
    words: z.coerce.number().default(50).describe('Target length in words'),
  }),
  handler: ({ text, words }) => ({
    messages: [
      {
        role: 'assistant' as const,
        content: { type: 'text' as const, text: `I will summarize in about ${words} words.` },
      },
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
    ],
  }),
})
