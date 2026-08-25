import type { ModuleOptions as LlmsOptions, LLMsSection } from 'nuxt-llms'
import { defineNitroPlugin } from 'nitropack/runtime'
import config from '#nuxt-mcp-toolkit/config.mjs'

const SECTION_TITLE = 'MCP Server'

function joinUrl(domain: string, path: string): string {
  return `${domain.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

function buildMcpLlmsSection(options: LlmsOptions): LLMsSection {
  const endpoint = joinUrl(options.domain, config.route)
  const links: NonNullable<LLMsSection['links']> = [
    {
      title: config.name || 'MCP endpoint',
      description: 'Streamable HTTP endpoint — connect an MCP client to this URL to call the tools, resources and prompts exposed by this site.',
      href: endpoint,
    },
  ]

  // `browserRedirect` is where humans land when opening the MCP route in a
  // browser, which is also the best documentation entry point for agents.
  if (config.browserRedirect && config.browserRedirect !== '/') {
    links.push({
      title: 'MCP documentation',
      description: 'How to connect to this MCP server.',
      href: joinUrl(options.domain, config.browserRedirect),
    })
  }

  return {
    title: SECTION_TITLE,
    description: config.description
      || `This site exposes a Model Context Protocol (MCP) server over streamable HTTP at ${endpoint}.`,
    links,
  }
}

/**
 * Advertise the MCP server inside `/llms.txt` so agents discovering the site
 * through llms.txt can connect to it without out-of-band configuration.
 *
 * `nuxt-llms` owns the file; this plugin only appends one section.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('llms:generate', (_event, options) => {
    if (!config.enabled) return

    // Idempotent: a site may already document its own MCP server, in which
    // case the author's section wins.
    if (options.sections.some(section => section.title === SECTION_TITLE)) return

    options.sections.push(buildMcpLlmsSection(options))
  })
})
