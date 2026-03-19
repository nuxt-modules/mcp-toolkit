import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Review code for best practices in a specific language',
  inputSchema: {
    language: completable(
      z.string().describe('Programming language'),
      (value: string) => ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'ruby', 'swift']
        .filter((lang: string) => lang.startsWith(value)),
    ),
  },
  handler: async ({ language }) => {
    return `You are a senior ${language} developer. Review the following code for best practices, potential bugs, and performance issues.`
  },
})
