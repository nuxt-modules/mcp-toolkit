import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { useEvent } from 'nitropack/runtime'

export interface McpServerHelper {
  /** Register a new tool mid-session. The client is notified automatically. */
  registerTool: McpServer['registerTool']
  /** Register a new prompt mid-session. The client is notified automatically. */
  registerPrompt: McpServer['registerPrompt']
  /** Register a new resource mid-session. The client is notified automatically. */
  registerResource: McpServer['registerResource']
  /** Remove a dynamically registered tool by name. Returns `true` if found. */
  removeTool(name: string): boolean
  /** Remove a dynamically registered prompt by name. Returns `true` if found. */
  removePrompt(name: string): boolean
  /** Remove a dynamically registered resource by name. Returns `true` if found. */
  removeResource(name: string): boolean
  /** The underlying `McpServer` instance for advanced SDK operations. */
  server: McpServer
}

interface Removable { remove: () => void }

interface Registrations {
  tools: Map<string, Removable>
  prompts: Map<string, Removable>
  resources: Map<string, Removable>
}

const registrations = new WeakMap<McpServer, Registrations>()

function getRegistrations(server: McpServer): Registrations {
  let reg = registrations.get(server)
  if (!reg) {
    reg = { tools: new Map(), prompts: new Map(), resources: new Map() }
    registrations.set(server, reg)
  }
  return reg
}

function removeByName(map: Map<string, Removable>, name: string): boolean {
  const handle = map.get(name)
  if (!handle) return false
  handle.remove()
  map.delete(name)
  return true
}

function wrapRegister(server: McpServer, method: 'registerTool' | 'registerPrompt' | 'registerResource', map: Map<string, Removable>) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const fn = (server[method] as any).bind(server)
  return (...args: any[]) => {
    const handle = fn(...args)
    map.set(args[0], handle)
    return handle
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * Returns a helper to mutate the MCP server mid-session.
 *
 * Use inside tool, resource, or prompt handlers to register, remove,
 * or update definitions while a session is active. The SDK automatically
 * sends `list_changed` notifications to the client.
 *
 * Requires `nitro.experimental.asyncContext: true` in your Nuxt config.
 */
export function useMcpServer(): McpServerHelper {
  const event = useEvent()
  const server = event.context._mcpServer as McpServer | undefined
  if (!server) {
    throw new Error(
      'No MCP server instance available. '
      + 'Ensure this is called within an MCP tool/resource/prompt handler '
      + 'and `nitro.experimental.asyncContext` is true.',
    )
  }

  const reg = getRegistrations(server)

  return {
    registerTool: wrapRegister(server, 'registerTool', reg.tools) as McpServer['registerTool'],
    registerPrompt: wrapRegister(server, 'registerPrompt', reg.prompts) as McpServer['registerPrompt'],
    registerResource: wrapRegister(server, 'registerResource', reg.resources) as McpServer['registerResource'],
    removeTool: (name: string) => removeByName(reg.tools, name),
    removePrompt: (name: string) => removeByName(reg.prompts, name),
    removeResource: (name: string) => removeByName(reg.resources, name),
    server,
  }
}
