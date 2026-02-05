import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { readBody } from 'h3'
import { createMcpTransportHandler } from './types'

export default createMcpTransportHandler(async (server, event) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  event.node.res.on('close', () => {
    transport.close()
    server.close()
  })
  await server.connect(transport)
  const body = await readBody(event)
  await transport.handleRequest(event.node.req, event.node.res, body)
})
