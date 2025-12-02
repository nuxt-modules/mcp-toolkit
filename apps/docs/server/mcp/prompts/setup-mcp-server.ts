export default defineMcpPrompt({
  description: 'Provides complete instructions for an AI to setup an MCP server in a Nuxt application using @nuxtjs/mcp-toolkit',
  handler: async () => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `You are setting up an MCP (Model Context Protocol) server in a Nuxt application using the @nuxtjs/mcp-toolkit module.

## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Getting Started**: https://mcp-toolkit.nuxt.dev/raw/getting-started/introduction.md
- **Installation Guide**: https://mcp-toolkit.nuxt.dev/raw/getting-started/installation.md
- **Configuration**: https://mcp-toolkit.nuxt.dev/raw/getting-started/configuration.md

## Installation

Run this command to install the module:

\`\`\`bash
npx nuxt module add mcp-toolkit
\`\`\`

Or manually install:

\`\`\`bash
pnpm add @nuxtjs/mcp-toolkit zod
\`\`\`

Then add to nuxt.config.ts:

\`\`\`typescript
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
  mcp: {
    name: 'My MCP Server', // Optional: customize server name
  },
})
\`\`\`

## Directory Structure

Create the following structure in your project:

\`\`\`
server/
└── mcp/
    ├── tools/       # MCP tools (actions the AI can perform)
    ├── resources/   # MCP resources (data the AI can read)
    └── prompts/     # MCP prompts (reusable message templates)
\`\`\`

## Example Tool

Create \`server/mcp/tools/hello.ts\`:

\`\`\`typescript
import { z } from 'zod'

export default defineMcpTool({
  description: 'Say hello to someone',
  inputSchema: {
    name: z.string().describe('The name to greet'),
  },
  handler: async ({ name }) => {
    return {
      content: [{
        type: 'text',
        text: \`Hello, \${name}!\`,
      }],
    }
  },
})
\`\`\`

## Example Resource

Create \`server/mcp/resources/readme.ts\`:

\`\`\`typescript
import { readFile } from 'node:fs/promises'

export default defineMcpResource({
  description: 'Read the project README file',
  uri: 'file:///README.md',
  mimeType: 'text/markdown',
  handler: async (uri: URL) => {
    const content = await readFile('README.md', 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        text: content,
        mimeType: 'text/markdown',
      }],
    }
  },
})
\`\`\`

## Example Prompt

Create \`server/mcp/prompts/code-review.ts\`:

\`\`\`typescript
import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Generate a code review prompt',
  inputSchema: {
    language: z.string().describe('Programming language'),
  },
  handler: async ({ language }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: \`Please review my \${language} code for best practices, potential bugs, and improvements.\`,
        },
      }],
    }
  },
})
\`\`\`

## Verify Installation

1. Start your Nuxt dev server: \`pnpm dev\`
2. Visit \`http://localhost:3000/mcp\` - you should be redirected (default behavior)
3. The MCP endpoint is now available for AI assistants to connect

## Key Points

- All helper functions (\`defineMcpTool\`, \`defineMcpResource\`, \`defineMcpPrompt\`) are auto-imported
- Use Zod for input validation with \`.describe()\` for better AI understanding
- The \`name\` and \`title\` are auto-generated from filenames if not provided
- Tools perform actions, Resources provide data, Prompts are message templates

## Learn More

For more details and advanced configuration, visit the official documentation:
- Full installation guide: https://mcp-toolkit.nuxt.dev/raw/getting-started/installation.md
- Configuration options: https://mcp-toolkit.nuxt.dev/raw/getting-started/configuration.md
- IDE connection setup: https://mcp-toolkit.nuxt.dev/raw/getting-started/connection.md`,
          },
        },
      ],
    }
  },
})
