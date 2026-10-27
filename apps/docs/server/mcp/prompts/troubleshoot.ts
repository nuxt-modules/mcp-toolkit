import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Diagnose an MCP integration problem',
  inputSchema: z.object({ problem: z.string().describe('What to work on') }),
  handler: ({ purpose }) => `Investigate this MCP problem: ${purpose}.
Record the installed toolkit, Nuxt, client, and protocol versions, the exact request, and the actual error. Read https://mcp-toolkit.nuxt.dev/getting-started/beta-migration before applying examples from older versions.
For discovery failures, check the endpoint's configured directories, layer overrides, build report, and generated server definitions. Each endpoint owns its own catalog.
For invocation failures, inspect the complete schema, request headers and metadata, current authorization context, and whether the client supports the requested capability. Check stream cancellation separately from ordinary request errors.
Reproduce with a real MCP client and retain a regression test for the cause. Fix the failing layer without restoring removed session helpers, SDK wrappers, Code Mode, or built-in Apps.`,
})
