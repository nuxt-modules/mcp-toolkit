import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'A helpful assistant prompt with customizable persona',
  inputSchema: {
    persona: z.enum(['friendly', 'professional', 'technical']).default('friendly').describe('The persona to use'),
    context: z.string().optional().describe('Additional context for the assistant'),
  },
  handler: async ({ persona, context }) => {
    const personas = {
      friendly: 'You are a friendly and helpful assistant. Be warm and encouraging in your responses.',
      professional: 'You are a professional assistant. Be concise, clear, and maintain a business-appropriate tone.',
      technical: 'You are a technical expert. Provide detailed, accurate information with code examples when relevant.',
    }

    const systemMessage = personas[persona]
    const contextMessage = context ? `\n\nAdditional context: ${context}` : ''

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${systemMessage}${contextMessage}`,
          },
        },
      ],
    }
  },
})
