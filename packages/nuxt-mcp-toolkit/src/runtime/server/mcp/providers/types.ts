import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { H3Event } from 'h3'

export type McpTransportHandler = (server: McpServer, event: H3Event) => Promise<Response | undefined> | Response | undefined

export const createMcpTransportHandler = (handler: McpTransportHandler): McpTransportHandler => handler
