import { defineNitroPlugin } from 'nitropack/runtime'
import config from '#nuxt-mcp-toolkit/config.mjs'

interface LlmsLink {
  title: string
  description?: string
  href: string
}

interface LlmsSection {
  title: string
  description?: string
  links?: LlmsLink[]
}

interface LlmsOptions {
  domain?: string
  sections?: LlmsSection[]
}

/** Loose hook surface — `nuxt-llms` is an optional peer, so its hook types may not be in scope. */
type LlmsHookable = {
  hook: (name: 'llms:generate', cb: (event: unknown, options: LlmsOptions) => void) => void
}

const SECTION_TITLE = 'MCP Server'

function joinUrl(domain: string | undefined, path: string): string {
  if (!domain) return path
  return `${domain.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Build the `/llms.txt` section describing this MCP server.
 *
 * Exported for testing — the plugin itself only wires it to the
 * `llms:generate` hook owned by `nuxt-llms`.
 */
export function buildMcpLlmsSection(options: LlmsOptions): LlmsSection {
  const endpoint = joinUrl(options.domain, config.route)
  const links: LlmsLink[] = [
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
  ;(nitroApp.hooks as unknown as LlmsHookable).hook('llms:generate', (_event, options) => {
    if (!config.enabled) return

    options.sections ??= []

    // Idempotent: a site may already document its own MCP server, in which
    // case the author's section wins.
    if (options.sections.some(section => section.title === SECTION_TITLE)) return

    options.sections.push(buildMcpLlmsSection(options))
  })
})
