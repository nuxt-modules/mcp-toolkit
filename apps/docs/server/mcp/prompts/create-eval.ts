import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Test MCP behavior and model tool selection',
  inputSchema: z.object({ purpose: z.string().describe('What to work on') }),
  handler: ({ purpose }) => `Build evaluations for this MCP behavior: ${purpose}.
Inspect the project's existing test setup and read https://mcp-toolkit.nuxt.dev/advanced/evals.
Use real MCP clients for deterministic checks of discovery, input validation, output shape, authorization, and errors. Cover modern and legacy protocol paths.
For model tool-selection evaluations, use Evalite with realistic user requests, expected tool choices, required arguments, and cases where no tool should run. Keep model evaluation separate from protocol regression tests.
Use sanitized fixtures, run the evaluations, and report actual results and any checks that could not run.`,
})
