import { defineMcpPrompt } from 'nitro-mcp-toolkit'
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate a code review prompt',
  inputSchema: {
    language: z.string().describe('The programming language of the code'),
    focus: z.enum(['security', 'performance', 'readability', 'all']).default('all').describe('What to focus on'),
  },
  handler: async ({ language, focus }) => {
    const focusAreas = {
      security: 'Focus primarily on security vulnerabilities, input validation, and potential exploits.',
      performance: 'Focus primarily on performance optimizations, memory usage, and algorithmic efficiency.',
      readability: 'Focus primarily on code readability, naming conventions, and documentation.',
      all: 'Review all aspects including security, performance, readability, and best practices.',
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are an expert ${language} code reviewer. ${focusAreas[focus]}

Please review the code that will be provided and give constructive feedback with specific suggestions for improvement.

Format your review with:
1. Overall assessment
2. Specific issues found (if any)
3. Suggestions for improvement
4. Positive aspects of the code`,
          },
        },
      ],
    }
  },
})
