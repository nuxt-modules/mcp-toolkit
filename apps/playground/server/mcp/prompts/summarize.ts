import { z } from 'zod'

export default defineMcpPrompt({
  name: 'summarize',
  title: 'Text Summarizer',
  description: 'Summarize any text content',
  inputSchema: {
    text: z.string().describe('The text to summarize'),
    maxLength: z.enum(['short', 'medium', 'long']).default('medium').describe('Maximum length of summary'),
  },
  handler: async ({ text, maxLength }) => {
    const summary = text.slice(0, maxLength === 'short' ? 100 : maxLength === 'medium' ? 200 : 300)

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Summary: ${summary}${text.length > summary.length ? '...' : ''}`,
        },
      }],
    }
  },
})
