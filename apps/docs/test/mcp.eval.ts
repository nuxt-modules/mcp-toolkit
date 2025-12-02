import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { generateText } from 'ai'
import { evalite } from 'evalite'
import { toolCallAccuracy } from 'evalite/scorers'

/**
 * MCP Evaluation Tests for nuxt-mcp-toolkit documentation server
 *
 * These evals verify that the LLM correctly selects and calls the MCP tools
 * exposed by this documentation site.
 *
 * Available tools:
 * - list-pages: Lists all documentation pages with titles, paths, and descriptions
 * - get-page: Retrieves the full markdown content of a documentation page
 *
 * Run with: pnpm eval
 * Run with UI: pnpm eval:ui
 */

// AI Gateway model format: provider/model-name
const model = 'openai/gpt-5.1-codex-mini'
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3000/mcp'

evalite('Documentation Tools - List Pages', {
  data: async () => [
    {
      input: 'List all available documentation pages',
      expected: [{ toolName: 'list-pages' }],
    },
    {
      input: 'What documentation is available?',
      expected: [{ toolName: 'list-pages' }],
    },
    {
      input: 'Show me the table of contents',
      expected: [{ toolName: 'list-pages' }],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({ transport: { type: 'http', url: MCP_URL } })
    try {
      const result = await generateText({
        model,
        prompt: input,
        tools: await mcp.tools(),
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected })],
})

evalite('Documentation Tools - Get Page', {
  data: async () => [
    {
      input: 'Show me the installation guide',
      expected: [{ toolName: 'get-page', input: { path: '/getting-started/installation' } }],
    },
    {
      input: 'Get the introduction page',
      expected: [{ toolName: 'get-page', input: { path: '/getting-started/introduction' } }],
    },
    {
      input: 'Read the tools documentation',
      expected: [{ toolName: 'get-page', input: { path: '/core-concepts/tools' } }],
    },
    {
      input: 'Show me how to create resources',
      expected: [{ toolName: 'get-page', input: { path: '/core-concepts/resources' } }],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({ transport: { type: 'http', url: MCP_URL } })
    try {
      const result = await generateText({
        model,
        prompt: input,
        tools: await mcp.tools(),
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected })],
})

evalite('Documentation Tools - Multi-Step Workflows', {
  data: async () => [
    {
      input: 'First list all pages, then show me the configuration guide',
      expected: [
        { toolName: 'list-pages' },
        { toolName: 'get-page', input: { path: '/getting-started/configuration' } },
      ],
    },
  ],
  task: async (input) => {
    const mcp = await createMCPClient({ transport: { type: 'http', url: MCP_URL } })
    try {
      const result = await generateText({
        model,
        prompt: input,
        tools: await mcp.tools(),
        maxSteps: 5,
      })
      return result.toolCalls ?? []
    }
    finally {
      await mcp.close()
    }
  },
  scorers: [({ output, expected }) => toolCallAccuracy({ actualCalls: output, expectedCalls: expected })],
})
