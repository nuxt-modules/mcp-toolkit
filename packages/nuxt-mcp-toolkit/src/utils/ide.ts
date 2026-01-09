import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type IDE = 'cursor' | 'vscode'

export const IDE_CONFIGS: Record<IDE, { name: string }> = {
  cursor: { name: 'Cursor' },
  vscode: { name: 'VS Code' },
}

export function terminalLink(text: string, url: string): string {
  return `\x1B]8;;${url}\x07${text}\x1B]8;;\x07`
}

export function isMCPInstalled(mcpJson: { mcpServers?: Record<string, { url?: string }> }, mcpUrl: string): boolean {
  if (!mcpJson.mcpServers) return false
  return Object.values(mcpJson.mcpServers).some(server => server.url === mcpUrl)
}

export function detectIDE(): IDE | null {
  const env = process.env
  if (env.__CFBundleIdentifier === 'com.todesktop.230313mzl4w4u92') return 'cursor'
  if (env.__CFBundleIdentifier === 'com.microsoft.VSCode') return 'vscode'
  if (env.CURSOR_TRACE_ID) return 'cursor'
  const ipc = env.VSCODE_IPC_HOOK || ''
  if (ipc.includes('/Cursor/')) return 'cursor'
  if (ipc.includes('/Code/')) return 'vscode'

  // Fallback: walk up the process tree to find Cursor or VS Code
  try {
    let pid = process.ppid
    for (let i = 0; i < 10 && pid > 1; i++) {
      const name = execSync(`ps -o comm= -p ${pid}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().toLowerCase()
      if (name.includes('cursor')) return 'cursor'
      if (name.includes('code helper') || name.includes('code.app')) return 'vscode'
      pid = Number.parseInt(execSync(`ps -o ppid= -p ${pid}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim())
    }
  }
  catch {
    // Process tree detection failed, continue with null
  }

  return null
}

export interface MCPConfigPath {
  path: string
  displayPath: string
}

export function getMCPConfigPaths(ide: IDE, rootDir: string): MCPConfigPath[] {
  return [
    {
      path: join(rootDir, `.${ide}/mcp.json`),
      displayPath: `.${ide}/mcp.json`,
    },
    {
      path: join(homedir(), `.${ide}/mcp.json`),
      displayPath: `~/.${ide}/mcp.json`,
    },
  ]
}

export function findInstalledMCPConfig(ide: IDE, rootDir: string, mcpUrl: string): MCPConfigPath | null {
  const configPaths = getMCPConfigPaths(ide, rootDir)

  for (const config of configPaths) {
    if (existsSync(config.path)) {
      try {
        const mcpJson = JSON.parse(readFileSync(config.path, 'utf8'))
        if (isMCPInstalled(mcpJson, mcpUrl)) {
          return config
        }
      }
      catch {
        // Failed to parse mcp.json, continue checking other paths
      }
    }
  }

  return null
}

export function generateDeeplinkUrl(baseUrl: string, route: string, ide: IDE, serverName: string): string {
  const mcpName = `local-${serverName.toLowerCase().replace(/\s+/g, '-')}`
  return `${baseUrl}${route}/deeplink?ide=${ide}&name=${encodeURIComponent(mcpName)}`
}
