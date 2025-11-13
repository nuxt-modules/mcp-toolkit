import { z } from 'zod'

const migrationTool = defineMcpTool({
  name: 'migrate-v3-to-v4',
  title: 'Migrate v3 to v4',
  description: 'Migrate code from version 3 to version 4',
  inputSchema: {
    code: z.string().describe('The code to migrate'),
  },
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

export default defineMcpHandler({
  name: 'migration',
  version: '0.1.0',
  route: '/mcp/migration',
  tools: [migrationTool],
  browserRedirect: '/',
})
