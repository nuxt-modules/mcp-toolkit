import { z } from 'zod'

export default defineMcpTool({
  name: 'migrate-v3-to-v4',
  title: 'Migrate v3 to v4',
  description: 'Migrate code from version 3 to version 4',
  inputSchema: z.object({
    code: z.string().describe('The code to migrate'),
  }),
  handler: async ({ code }) => {
    const migrated = code.replace(/v3/g, 'v4')
    return {
      content: [{
        type: 'text',
        text: migrated,
      }],
    }
  },
})
