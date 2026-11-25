import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Create an MCP prompt',
  inputSchema: z.object({ purpose: z.string().describe('What to work on') }),
  handler: ({ purpose }) => `Create this MCP prompt: ${purpose}.
Inspect the installed toolkit version and read https://mcp-toolkit.nuxt.dev/prompts/overview and the beta migration guide.
Export defineMcpPrompt from server/mcp/prompts. Use a complete schema for inputs and the request event for application context.
Return a string for one user message, or an explicit messages result when roles or content blocks matter. Use arguments entries for completion callbacks instead of SDK completable wrappers.
Test prompt discovery, arguments, message content, and authorization with a real client.`,
})
