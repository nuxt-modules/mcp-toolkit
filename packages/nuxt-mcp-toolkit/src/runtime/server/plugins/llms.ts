import type { ModuleOptions as LlmsOptions, LLMsSection } from 'nuxt-llms'
import { defineNitroPlugin } from 'nitropack/runtime'
import config from '#nuxt-mcp-toolkit/config.mjs'

const SECTION_TITLE = 'MCP Server'

function joinUrl(domain: string, path: string): string {
  if (URL.canParse(path)) return path
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

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('llms:generate', (_event, options) => {
    if (options.sections.some(section => section.title === SECTION_TITLE)) return

    options.sections.push(buildMcpLlmsSection(options))
  })
})
