---
seo:
  ogImage: /og.jpg
  title: Expose your application to any LLM
  description: Add a Model Context Protocol (MCP) server to your Nuxt application. Connect your features to AI clients with a Nitro-like Developer Experience.
---

::landing-hero
---
command: npx skills add nuxt-modules/mcp-toolkit
installCommand: npx nuxt module add mcp-toolkit
linkLabel: Get Started
linkTo: /getting-started/installation
---
#title
Expose your application to any AI

#description
Add a Model Context Protocol (MCP) server to your Nuxt application. Connect your features to AI clients with a Nitro-like Developer Experience.
::

::landing-features
#title
Make your App accessible to Ai

#description
Use the Model Context Protocol to standardize how LLMs interact with your Nuxt application.

#features
:landing-feature-item{description="Use familiar patterns like defineMcpTool and defineMcpResource. It feels just like writing API routes." icon="i-lucide-code-2" title="Nitro-like API"}

:landing-feature-item{description="Automatic discovery of tools, resources and prompts. Just create files in the server/mcp directory." icon="i-lucide-sparkles" title="Zero Configuration"}

:landing-feature-item{description="Cache tool and resource responses with Nitro. Just add cache: '1h' to your definition." icon="i-lucide-database" title="Built-in Cache"}

:landing-feature-item{description="InstallButton component and SVG badges to let users add your MCP server to their IDE instantly." icon="i-lucide-download" title="1-Click Install"}

:landing-feature-item{description="Built on the official MCP SDK, ensuring compatibility with all MCP clients like Claude, ChatGPT and more." icon="i-lucide-check-circle-2" title="Standard Compatible"}

:landing-feature-item{description="Define your tools with Zod schemas and full TypeScript inference. No more guessing arguments types." icon="i-lucide-shield-check" title="Type-Safe Tools"}

:landing-feature-item{description="Debug your MCP server in real-time with the built-in inspector. View requests, responses and errors." icon="i-lucide-bug" title="DevTools Integrated"}

  :::landing-feature-cta
  ---
  icon: i-lucide-arrow-right
  label: Get Started
  to: /getting-started/installation
  ---
  #title
  Start building now
  :::
::

::landing-code
#title
Just Write Code

#description
Define tools, resources and prompts using standard TypeScript files. No complex configuration or boilerplate required.

#tools
```ts
// server/mcp/tools/weather.ts
import { z } from 'zod'

export default defineMcpTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  inputSchema: {
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
  },
  cache: '1h', // (optional) cache for 1 hour
  handler: async ({ city, unit }) => {
    return `Weather in ${city} is 20° ${unit}`
  }
})
```

#resources
```ts
// server/mcp/resources/readme.ts
export default defineMcpResource({
  file: 'README.md',
  name: 'Project README',
  description: 'The project documentation',
  annotations: {
    audience: ['user', 'assistant'],
    lastModified: new Date().toISOString(),
  }
})
```

#prompts
```ts
// server/mcp/prompts/summarize.ts
import { z } from 'zod'

export default defineMcpPrompt({
  name: 'summarize',
  description: 'Summarize a text',
  inputSchema: {
    text: z.string().describe('Text to summarize')
  },
  handler: async ({ text }) => {
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Please summarize: ${text}`
        }
      }]
    }
  }
})
```
::

::landing-dev-tools
---
darkImage: /mcp-devtools-dark.png
imageAlt: Nuxt MCP DevTools
lightImage: /mcp-devtools-light.png
---
#title
Built-in Inspector

#description
Debug your MCP server in real-time. View registered tools, resources, and prompts, and monitor client connections and request logs.
::

::landing-cta
---
links:
  - label: Get Started
    to: /getting-started/installation
    icon: i-lucide-arrow-right
    trailing: true
    color: neutral
    size: xl
  - label: Star on GitHub
    to: https://github.com/nuxt-modules/mcp-toolkit
    icon: i-lucide-github
    trailing: true
    color: neutral
    variant: ghost
    size: xl
---
#title
Ready to build your first MCP Server?

#description
Get started in minutes with our comprehensive guide and examples.
::
