---
seo:
  ogImage: /og.jpg
  title: Expose your application to any LLM
  description: Add a Model Context Protocol (MCP) server to your Nuxt application. Connect your features to AI clients with a Nitro-like Developer Experience.
---

::landing-hero
---
command: npx skills add https://mcp-toolkit.nuxt.dev
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
Make your App accessible to AI

#description
Use the Model Context Protocol to standardize how LLMs interact with your Nuxt application.

#features
:landing-feature-item{description="Use familiar patterns like defineMcpTool and defineMcpResource. It feels just like writing API routes." icon="i-lucide-code-2" title="Nitro-like API" to="/core-concepts/tools"}

:landing-feature-item{description="Automatic discovery of tools, resources and prompts. Just create files in the server/mcp directory." icon="i-lucide-sparkles" title="Zero Configuration" to="/getting-started/installation"}

:landing-feature-item{description="Define your tools with Zod schemas and full TypeScript inference. No more guessing argument types." icon="i-lucide-shield-check" title="Type-Safe Tools" to="/advanced/typescript"}

:landing-feature-item{description="Built on the official MCP SDK, ensuring compatibility with all MCP clients like Claude, Cursor, ChatGPT and more." icon="i-lucide-check-circle-2" title="Standard Compatible" to="/getting-started/connection"}

:landing-feature-item{description="Let LLMs write JavaScript that orchestrates tools in a secure V8 sandbox. Cut token overhead by up to 82%." icon="i-lucide-terminal" title="Code Mode" to="/advanced/code-mode"}

:landing-feature-item{description="Intercept requests to add authentication, logging and rate limiting. Access event context from your tools." icon="i-lucide-shield" title="Middleware" to="/advanced/middleware"}

:landing-feature-item{description="Cache tool and resource responses with Nitro. Just add cache: '1h' to any definition." icon="i-lucide-zap" title="Built-in Cache" to="/core-concepts/tools#response-caching"}

:landing-feature-item{description="Persist state across tool calls with useMcpSession(). Build multi-step workflows and track conversations." icon="i-lucide-save" title="Sessions" to="/advanced/sessions"}

:landing-feature-item{description="Show different tools per user with enabled guards. Control visibility based on authentication, roles or context." icon="i-lucide-toggle-right" title="Dynamic Definitions" to="/advanced/dynamic-definitions"}

:landing-feature-item{description="InstallButton component, SVG badges and deeplinks to let users add your MCP server to their IDE instantly." icon="i-lucide-download" title="1-Click Install" to="/getting-started/connection"}

:landing-feature-item{description="Create separate MCP endpoints with their own tools, resources and configuration. Organize by domain or version." icon="i-lucide-server" title="Multiple Handlers" to="/core-concepts/handlers"}

:landing-feature-item{description="Verify LLMs call the right tools with the AI SDK and Evalite. Catch regressions before they reach production." icon="i-lucide-flask-conical" title="Evals" to="/advanced/evals"}

:landing-feature-item{description="Let AI assistants help you build, review and troubleshoot your MCP server with the Agent Skills specification." icon="i-lucide-wand-2" title="Agent Skills" to="/getting-started/agent-skills"}

:landing-feature-item{description="Organize tools, resources and prompts into groups with tags. Auto-inferred from subdirectories or set explicitly." icon="i-lucide-tags" title="Groups & Tags" to="/core-concepts/tools#groups-and-tags"}

:landing-feature-item{description="Debug your MCP server in real-time with the built-in inspector. View tools, resources, prompts, connections and logs." icon="i-lucide-bug" title="DevTools Integrated" to="/getting-started/inspector"}

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
  description: 'Get current weather for a location',
  inputSchema: {
    city: z.string().describe('City name'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
  },
  annotations: { readOnlyHint: true },
  cache: '1h',
  handler: async ({ city, unit }) => {
    const data = await fetchWeather(city)
    return { temperature: data.temp, unit, city }
  }
})
```

#resources
```ts
// server/mcp/resources/readme.ts
export default defineMcpResource({
  file: 'README.md',
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
  description: 'Summarize a text',
  inputSchema: {
    text: z.string().describe('Text to summarize'),
    format: z.enum(['bullet-points', 'paragraph']).default('paragraph')
  },
  handler: async ({ text, format }) =>
    `Summarize this text as ${format}:\n\n${text}`
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
