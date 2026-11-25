import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Create a typed MCP tool',
  inputSchema: z.object({ purpose: z.string().describe('What to work on') }),
  handler: ({ purpose }) => `Create this MCP tool: ${purpose}.
Inspect the installed toolkit version and neighboring definitions. Read https://mcp-toolkit.nuxt.dev/tools/schema-handler and the beta migration guide.
Define a default export in server/mcp/tools using complete input and output schemas, such as z.object(...). Give arguments descriptions that explain when and how to use them.
Keep business logic in application services. Read verified identity from the callback event and authorize each operation. Return output-schema data directly, or use toolResult for a protocol envelope.
Test valid input, invalid input, execution failures, and authorization with real modern and legacy clients.`,
})
