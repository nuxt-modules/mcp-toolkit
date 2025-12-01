import { defineEventHandler, sendRedirect, getRequestURL, getQuery } from 'h3'
import { useRuntimeConfig } from '#imports'

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
      return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${configBase64}`
    },
  },
  vscode: {
    name: 'VS Code',
    generateDeeplink: (serverName: string, mcpUrl: string) => {
      const config = { type: 'http', url: mcpUrl }
      const configJson = JSON.stringify(config)
      return `vscode:mcp/install?name=${encodeURIComponent(serverName)}&config=${encodeURIComponent(configJson)}`
    },
  },
}

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event).mcp
  const requestUrl = getRequestURL(event)
  const query = getQuery(event)

  // Get IDE from query param, default to 'cursor'
  const ide = (query.ide as SupportedIDE) || 'cursor'

  // Validate IDE
  if (!IDE_CONFIGS[ide]) {
    return sendRedirect(event, '/', 302)
  }

  // Get the server name from config or use a default
  const serverName = runtimeConfig.name || 'mcp-server'

  // Build the MCP server URL (the /mcp endpoint)
  const mcpUrl = `${requestUrl.origin}${runtimeConfig.route || '/mcp'}`

  // Generate the deeplink for the selected IDE
  const deeplink = IDE_CONFIGS[ide].generateDeeplink(serverName, mcpUrl)

  // Redirect to the deeplink
  return sendRedirect(event, deeplink, 302)
})
