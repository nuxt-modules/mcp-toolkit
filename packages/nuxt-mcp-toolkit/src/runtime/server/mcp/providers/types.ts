import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { H3Event } from 'h3'

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export type McpTransportHandler = (server: McpServer, event: H3Event) => Promise<Response | void> | Response | void

export const createMcpTransportHandler = (handler: McpTransportHandler): McpTransportHandler => handler
