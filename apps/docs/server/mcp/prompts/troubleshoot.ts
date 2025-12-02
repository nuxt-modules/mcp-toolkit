import { z } from 'zod'

export default defineMcpPrompt({
  description: 'Help diagnose and fix common MCP server issues',
  inputSchema: {
    issue: z.enum([
      'auto-imports',
      'endpoint-not-accessible',
      'zod-validation',
      'resource-cache',
      'tool-not-found',
      'general',
    ]).describe('The type of issue you are experiencing'),
  },
  handler: async ({ issue }) => {
    const docsHeader = `## Documentation

- **Official Documentation**: https://mcp-toolkit.nuxt.dev/
- **Installation Guide**: https://mcp-toolkit.nuxt.dev/raw/getting-started/installation.md
- **Configuration**: https://mcp-toolkit.nuxt.dev/raw/getting-started/configuration.md
- **DevTools Inspector**: https://mcp-toolkit.nuxt.dev/raw/getting-started/inspector.md

---

`
    const troubleshootingGuides: Record<string, string> = {
      'auto-imports': docsHeader + `## Auto-Imports Not Working

If \`defineMcpTool\`, \`defineMcpResource\`, or \`defineMcpPrompt\` are not auto-imported:

### 1. Check Module Installation

Ensure the module is properly installed and configured:

\`\`\`typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxtjs/mcp-toolkit'],
})
\`\`\`

### 2. Restart the Dev Server

Auto-imports are generated at startup. Restart your dev server:

\`\`\`bash
# Stop the server (Ctrl+C) then restart
pnpm dev
\`\`\`

### 3. Check File Location

Files must be in \`server/mcp/\` directory (or your custom \`dir\` path):

\`\`\`
server/
└── mcp/
    ├── tools/      ✅ defineMcpTool available
    ├── resources/  ✅ defineMcpResource available
    └── prompts/    ✅ defineMcpPrompt available
\`\`\`

### 4. Regenerate Types

\`\`\`bash
pnpm nuxt prepare
\`\`\`

### 5. Check TypeScript Config

Ensure \`.nuxt/types\` is included in your tsconfig.json.`,

      'endpoint-not-accessible': docsHeader + `## MCP Endpoint Not Accessible

If you can't connect to the MCP endpoint:

### 1. Check the Route

Default route is \`/mcp\`. Verify in your config:

\`\`\`typescript
// nuxt.config.ts
export default defineNuxtConfig({
  mcp: {
    route: '/mcp', // Default
  },
})
\`\`\`

### 2. Test the Endpoint

\`\`\`bash
# Should return a redirect or MCP response
curl -v http://localhost:3000/mcp
\`\`\`

### 3. Check if Module is Enabled

\`\`\`typescript
mcp: {
  enabled: true, // Must be true (default)
}
\`\`\`

### 4. Check Server Logs

Look for any errors in the terminal where Nuxt is running.

### 5. Verify MCP Client Configuration

For Cursor/VS Code, check your MCP server config:

\`\`\`json
{
  "mcpServers": {
    "my-app": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
\`\`\``,

      'zod-validation': docsHeader + `## Zod Validation Errors

If your tool/resource/prompt fails with validation errors:

### 1. Check Input Schema Types

Ensure your schema matches the expected input:

\`\`\`typescript
inputSchema: {
  // ✅ Correct - string with describe
  name: z.string().describe('User name'),

  // ❌ Wrong - missing describe (works but not recommended)
  name: z.string(),

  // ✅ Optional parameter
  age: z.number().optional().describe('User age'),

  // ✅ With default value
  limit: z.number().default(10).describe('Max results'),
}
\`\`\`

### 2. Check for Required vs Optional

\`\`\`typescript
// Required - must be provided
name: z.string()

// Optional - can be undefined
name: z.string().optional()

// Optional with default - always has a value
name: z.string().default('anonymous')
\`\`\`

### 3. Enum Values Must Match Exactly

\`\`\`typescript
// Input must be exactly 'json', 'xml', or 'text'
format: z.enum(['json', 'xml', 'text'])
\`\`\`

### 4. Check Error Messages

Zod provides detailed error messages. Check the server logs for specifics.`,

      'resource-cache': docsHeader + `## Resource Caching Issues

If resources are returning stale data or not caching properly:

### 1. Cache Duration Format

\`\`\`typescript
export default defineMcpResource({
  cache: '5m',  // 5 minutes
  cache: '1h',  // 1 hour
  cache: '1d',  // 1 day
  // No cache property = no caching
})
\`\`\`

### 2. Force Fresh Data

During development, you may need to restart the server to clear cache.

### 3. Conditional Caching

For dynamic data, consider shorter cache times or no caching:

\`\`\`typescript
export default defineMcpResource({
  // No cache for real-time data
  handler: async (uri) => {
    const data = await fetchLiveData()
    return { contents: [{ uri: uri.toString(), text: data }] }
  },
})
\`\`\`

### 4. Check Cache Headers

The module handles caching internally. If you need custom behavior, consider using a handler instead of a resource.`,

      'tool-not-found': docsHeader + `## Tool/Resource/Prompt Not Found

If your MCP definitions aren't being discovered:

### 1. Check File Extension

Files must be \`.ts\` or \`.js\`:

\`\`\`
server/mcp/tools/
├── my-tool.ts  ✅
├── my-tool.js  ✅
├── my-tool.tsx ❌
└── my-tool.mjs ❌
\`\`\`

### 2. Check Default Export

Must use \`export default\`:

\`\`\`typescript
// ✅ Correct
export default defineMcpTool({ ... })

// ❌ Wrong - named export
export const myTool = defineMcpTool({ ... })
\`\`\`

### 3. Check Directory Structure

\`\`\`
server/
└── mcp/           # Or your custom 'dir' value
    ├── tools/     # defineMcpTool
    ├── resources/ # defineMcpResource
    └── prompts/   # defineMcpPrompt
\`\`\`

### 4. Check Custom Directory Config

\`\`\`typescript
// nuxt.config.ts
export default defineNuxtConfig({
  mcp: {
    dir: 'mcp', // Default - looks in server/mcp/
    dir: 'my-mcp', // Custom - looks in server/my-mcp/
  },
})
\`\`\`

### 5. Restart Dev Server

After adding new files, restart the dev server.`,

      'general': docsHeader + `## General Troubleshooting

### Quick Checklist

1. **Module installed?**
   \`\`\`bash
   pnpm list @nuxtjs/mcp-toolkit
   \`\`\`

2. **Module in nuxt.config.ts?**
   \`\`\`typescript
   modules: ['@nuxtjs/mcp-toolkit']
   \`\`\`

3. **Zod installed?**
   \`\`\`bash
   pnpm list zod
   \`\`\`

4. **Correct directory structure?**
   \`\`\`
   server/mcp/{tools,resources,prompts}/
   \`\`\`

5. **Dev server restarted after changes?**

### Debug Mode

Check the Nuxt DevTools MCP Inspector:
1. Open DevTools (Shift+Alt+D)
2. Look for the MCP tab
3. Inspect registered tools, resources, and prompts

### Common Fixes

- **Restart dev server** after config changes
- **Run \`nuxt prepare\`** to regenerate types
- **Check server logs** for detailed error messages
- **Verify Zod schemas** match expected input types

### Getting Help

- Documentation: https://mcp-toolkit.nuxt.dev/
- Raw Documentation: https://mcp-toolkit.nuxt.dev/raw/getting-started/introduction.md
- GitHub Issues: https://github.com/nuxt/mcp-toolkit/issues
- Discord: https://discord.nuxt.com`,
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: troubleshootingGuides[issue],
          },
        },
      ],
    }
  },
})
