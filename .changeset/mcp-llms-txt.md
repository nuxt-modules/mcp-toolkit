---
"@nuxtjs/mcp-toolkit": minor
---

Advertise the MCP server in `/llms.txt` when [`nuxt-llms`](https://github.com/nuxt-content/nuxt-llms) is registered.

Agents that discover a site through `llms.txt` can now find its MCP endpoint without a hand-configured URL. Register both modules and an `## MCP Server` section is appended to the file:

```md [llms.txt]
## MCP Server

Query Example data from your agent.

- [Example MCP](https://example.com/mcp): Streamable HTTP endpoint — connect an MCP client to this URL to call the tools, resources and prompts exposed by this site.
- [MCP documentation](https://example.com/docs/mcp): How to connect to this MCP server.
```

The section is built from `llms.domain` + `mcp.route` (endpoint URL), `mcp.name` (label), `mcp.description` (section description), and `mcp.browserRedirect` (documentation link, when set to something other than `/`).

Set `mcp.llms: false` to leave `/llms.txt` untouched. A section you title `MCP Server` yourself always wins, and nothing is registered when `nuxt-llms` isn't installed.

Note this is a discoverability convention, not part of the MCP specification — spec'd discovery through an AI Catalog and Server Cards is still a draft.
