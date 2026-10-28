---
seo:
  ogImage: /og.jpg
  title: Expose your Nuxt app to any LLM with MCP — Nuxt MCP Toolkit
  description: Add a Model Context Protocol (MCP) server to your Nuxt application. Connect your features to AI clients with a Nitro-like Developer Experience.
---

::landing-hero
---
command: npx skills add https://mcp-toolkit.nuxt.dev
installCommand: npx nuxt add mcp
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
:landing-feature-item{description="Use familiar patterns like defineMcpTool and defineMcpResource. It feels just like writing API routes." icon="i-lucide-code-2" title="Nitro-like API" to="/tools/overview"}

:landing-feature-item{description="Automatic discovery of tools, resources and prompts. Just create files in the server/mcp directory." icon="i-lucide-sparkles" title="Zero Configuration" to="/getting-started/installation"}

:landing-feature-item{description="Define your tools with Zod schemas and full TypeScript inference. No more guessing argument types." icon="i-lucide-shield-check" title="Type-Safe Tools" to="/advanced/typescript"}

:landing-feature-item{description="Share the Nitro MCP runtime, with modern and legacy protocol paths for clients such as Claude, Cursor and ChatGPT." icon="i-lucide-check-circle-2" title="Standard Compatible" to="/getting-started/connection"}


:landing-feature-item{description="Advertise and validate output schemas, with structured data and a JSON text fallback for clients." icon="i-lucide-braces" title="Structured Output" to="/tools/schema-handler"}

:landing-feature-item{description="Intercept requests to add authentication, logging and rate limiting. Access event context from your tools." icon="i-lucide-shield" title="Middleware" to="/advanced/middleware"}

:landing-feature-item{description="Reuse application work with Nitro cached functions. Keep typed outputs and choose cache keys and storage explicitly." icon="i-lucide-zap" title="Nitro Caching" to="/tools/errors-caching"}

:landing-feature-item{description="Describe inputs with complete schemas, defaults and examples. Omit input declarations for tools without arguments." icon="i-lucide-list-checks" title="Schema Validation" to="/tools/schema-handler"}

:landing-feature-item{description="Authenticate endpoints and require verified scopes when tools run. Give private catalogs their own endpoint." icon="i-lucide-lock" title="Authorization" to="/tools/groups-organization"}

:landing-feature-item{description="InstallButton component, SVG badges and deeplinks to let users add your MCP server to their IDE instantly." icon="i-lucide-download" title="1-Click Install" to="/getting-started/connection"}

:landing-feature-item{description="Create separate MCP endpoints with their own tools, resources and configuration. Organize by domain or version." icon="i-lucide-server" title="Multiple Endpoints" to="/tools/groups-organization#give-each-endpoint-its-own-directories"}

:landing-feature-item{description="Verify LLMs call the right tools with the AI SDK and Evalite. Catch regressions before they reach production." icon="i-lucide-flask-conical" title="Evals" to="/advanced/evals"}

:landing-feature-item{description="Let AI assistants help you build, review and troubleshoot your MCP server with the Agent Skills specification." icon="i-lucide-wand-2" title="Agent Skills" to="/getting-started/agent-skills"}

:landing-feature-item{description="Organize tools, resources and prompts into groups with tags. Auto-inferred from subdirectories or set explicitly." icon="i-lucide-tags" title="Groups & Tags" to="/tools/groups-organization#groups-and-tags"}

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
// server/mcp/tools/calculate-total.ts
import { z } from 'zod'
import { defineMcpTool } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpTool({
  description: 'Add a list of numbers',
  annotations: { readOnlyHint: true, openWorldHint: false },
  inputSchema: z.object({ values: z.array(z.number()) }),
  outputSchema: z.object({ total: z.number() }),
  handler: ({ values }) => ({ total: values.reduce((sum, value) => sum + value, 0) }),
})
```

#resources
```ts
// server/mcp/resources/help.ts
import { defineMcpResource } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpResource({
  uri: 'docs://help',
  description: 'Application help',
  mimeType: 'text/plain',
  handler: () => 'Use the total tool to add numbers.',
})
```

#prompts
```ts
// server/mcp/prompts/summarize.ts
import { z } from 'zod'
import { defineMcpPrompt } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpPrompt({
  description: 'Summarize text',
  inputSchema: z.object({ text: z.string() }),
  handler: ({ text }) => `Summarize this text:\n\n${text}`,
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
