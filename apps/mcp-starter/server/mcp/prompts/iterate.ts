import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  name: 'iterate',
  description: 'Bootstraps an AI session: ask clarifying questions, then extend this MCP server.',
  inputSchema: z.object({
    goal: z.string().describe('Initial idea or domain for the MCP (details can follow in chat)'),
  }),
  handler: async ({ goal }) => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Extend this Nuxt MCP server (@nuxtjs/mcp-toolkit). Docs: https://mcp-toolkit.nuxt.dev',
              'Add or change files under server/mcp/tools, server/mcp/resources, server/mcp/prompts.',
              'Import defineMcpTool, defineMcpResource, defineMcpPrompt from @nuxtjs/mcp-toolkit/server; use Zod for schemas.',
              'Ask what we should build next, then implement.',
              '',
              `Starting hint: ${goal}`,
            ].join('\n'),
          },
        },
      ],
    }
  },
})
