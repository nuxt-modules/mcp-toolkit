import { z } from 'zod'

export default defineMcpPrompt({
  name: 'summarize',
  title: 'Text Summarizer',
  description: 'Summarize any text content',
  argsSchema: {
    text: z.string().describe('The text to summarize'),
    maxLength: z.string().optional().describe('Maximum length of summary in words'),
  },
  handler: async ({ text, maxLength }) => {
    const words = text.split(/\s+/)
    const maxWords = maxLength ? Number.parseInt(maxLength) : Math.ceil(words.length * 0.3)
    const summary = words.slice(0, maxWords).join(' ')

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Summary (${maxWords} words): ${summary}${words.length > maxWords ? '...' : ''}`,
        },
      }],
    }
  },
})
