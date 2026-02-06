import { defineEventHandler, getRequestURL, getQuery, setHeader } from 'h3'
// @ts-expect-error - virtual module
import mcpConfig from '#nuxt-mcp-toolkit/config.mjs'

export type SupportedIDE = 'cursor' | 'vscode'

interface IDEConfig {
  name: string
  generateDeeplink: (serverName: string, mcpUrl: string) => string
}

const IDE_CONFIGS: Record<SupportedIDE, IDEConfig> = {
  cursor: {
    name: 'Cursor',
    generateDeeplink: (serverName: string, mcpUrl: string) => {
      const config = { type: 'http', url: mcpUrl }
      const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64')
      return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(configBase64)}`
    },
  },
  vscode: {
    name: 'VS Code',
    generateDeeplink: (serverName: string, mcpUrl: string) => {
      const config = { name: serverName, type: 'http', url: mcpUrl }
      return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`
    },
  },
}

// Escape string for safe use in HTML attributes
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Escape string for safe use in JavaScript strings
function escapeJs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, '\\\'')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
}

export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event)
  const query = getQuery(event)

  const ide = (query.ide as SupportedIDE) || 'cursor'
  const ideConfig = IDE_CONFIGS[ide]
  if (!ideConfig) {
    setHeader(event, 'Location', '/')
    return new Response(null, { status: 302 })
  }

  const serverName = (query.name as string) || mcpConfig.name || 'mcp-server'

  // Build the MCP server URL (the /mcp endpoint)
  const mcpUrl = `${requestUrl.origin}${mcpConfig.route || '/mcp'}`

  // Generate the deeplink for the selected IDE
  const deeplink = ideConfig.generateDeeplink(serverName, mcpUrl)

  // Escape for HTML attribute and JavaScript separately
  const htmlDeeplink = escapeHtmlAttr(deeplink)
  const jsDeeplink = escapeJs(deeplink)

  // Return HTML page that redirects via JavaScript (for custom protocol support)
  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Opening ${ideConfig.name}...</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fff; }
    .container { text-align: center; padding: 2rem; }
    a { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <p>Opening ${ideConfig.name}...</p>
    <p>If nothing happens, <a href="${htmlDeeplink}">click here to install</a>.</p>
  </div>
  <script>window.location.href = "${jsDeeplink}";</script>
</body>
</html>`
})
