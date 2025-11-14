---
seo:
  title: Nuxt MCP Module - Model Context Protocol Server for Nuxt
  description: Create MCP servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.
---

::u-page-hero
#title
Nuxt MCP Module

#description
Create [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers directly in your Nuxt application. Define tools, resources, and prompts with a simple and intuitive API.

#links
  :::u-button
  ---
  color: primary
  size: xl
  to: /getting-started/installation
  trailing-icon: i-lucide-arrow-right
  ---
  Get Started
  :::

  :::u-button
  ---
  color: neutral
  icon: simple-icons-github
  size: xl
  to: https://github.com/HugoRCD/nuxt-mcp-module
  variant: outline
  ---
  View on GitHub
  :::
::

::u-page-section
#title
Powerful Features

#features
  :::u-page-feature
  ---
  icon: i-lucide-wrench
  ---
  #title
  Simple Tool Definitions

  #description
  Create MCP tools with Zod validation, input/output schemas, and automatic type inference. Full TypeScript support with auto-completion.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-package
  ---
  #title
  Resource Management

  #description
  Expose resources accessible via URI. Support both static resources and dynamic resources with templates for flexible data access.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-message-square
  ---
  #title
  Custom Prompts

  #description
  Create reusable prompts for your assistants. Support prompts with or without arguments, all with full type safety.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-server
  ---
  #title
  Multiple Handlers

  #description
  Create multiple MCP endpoints in a single Nuxt application. Each handler can have its own tools, resources, and prompts.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-search
  ---
  #title
  Auto-Discovery

  #description
  Automatic discovery of definitions in your project. Just create files in the right directories and they're automatically registered.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-code
  ---
  #title
  TypeScript First

  #description
  Full TypeScript support with auto-imports. All helpers are available globally in your server files with complete type safety.
  :::
::

::u-page-section
#title
Quick Example

See how easy it is to create an MCP tool:

::code-group

```typescript [server/mcp/tools/echo.ts]
import { z } from 'zod'

export default defineMcpTool({
  name: 'echo',
  description: 'Echo back a message',
  inputSchema: {
    message: z.string().describe('The message to echo back'),
  },
  handler: async ({ message }) => {
    return {
      content: [{
        type: 'text',
        text: `Echo: ${message}`,
      }],
    }
  },
})
```

```typescript [server/mcp/resources/readme.ts]
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export default defineMcpResource({
  name: 'readme',
  title: 'README',
  uri: 'file:///README.md',
  metadata: {
    description: 'Project README file',
    mimeType: 'text/markdown',
  },
  handler: async (uri: URL) => {
    const filePath = fileURLToPath(uri)
    const content = await readFile(filePath, 'utf-8')
    return {
      contents: [{
        uri: uri.toString(),
        mimeType: 'text/markdown',
        text: content,
      }],
    }
  },
})
```

```typescript [server/mcp/prompts/greeting.ts]
export default defineMcpPrompt({
  name: 'greeting',
  title: 'Greeting',
  description: 'Generate a personalized greeting message',
  handler: async () => {
    const hour = new Date().getHours()
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'

    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Good ${timeOfDay}! How can I help you today?`,
        },
      }],
    }
  },
})
```

::

::callout{icon="i-lucide-rocket" color="primary"}
**Ready to get started?** Check out the [Installation Guide](/getting-started/installation) or jump to the [Quick Start](/getting-started/quick-start) for a minimal example.
::
