import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Create an MCP resource',
  inputSchema: z.object({ purpose: z.string().describe('What to work on') }),
  handler: ({ purpose }) => `Create this MCP resource: ${purpose}.
Inspect the installed toolkit version and read https://mcp-toolkit.nuxt.dev/resources/overview and the beta migration guide.
Use defineMcpResource in server/mcp/resources. Choose uri for a fixed resource or uriTemplate for parameters. Keep mimeType and other metadata at the top level.
Return text or an explicit contents result; template enumeration returns descriptors. Authorize reads, enumeration, and completion using the current request context.
Test listing and reading the resource with a real client, including missing resources and unauthorized requests.`,
})
