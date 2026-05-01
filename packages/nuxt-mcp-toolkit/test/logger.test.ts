import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

function createMcpUrl(path = '/mcp') {
  const baseUrl = url('/')
  const baseUrlObj = new URL(baseUrl)
  const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
  return new URL(path, origin)
}

interface CapturedNotification {
  level: string
  data: unknown
  logger?: string
}

async function createLoggingClient(headers?: Record<string, string>): Promise<{
  client: Client
  notifications: CapturedNotification[]
}> {
  const notifications: CapturedNotification[] = []
  const client = new Client({ name: 'logger-test-client', version: '1.0.0' })

  client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
    notifications.push(notification.params as CapturedNotification)
  })

  const transport = headers
    ? new StreamableHTTPClientTransport(createMcpUrl(), { requestInit: { headers } })
    : new StreamableHTTPClientTransport(createMcpUrl())

  await client.connect(transport)
  return { client, notifications }
}

async function waitForNotifications(notifications: CapturedNotification[], expected: number, timeoutMs = 1500) {
  const start = Date.now()
  while (notifications.length < expected) {
    if (Date.now() - start > timeoutMs) break
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

describe('useMcpLogger', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/logger', import.meta.url)),
  })

  const opened: Client[] = []

  afterAll(async () => {
    for (const c of opened) {
      try {
        await c.close()
      }
      catch {
        // Ignore close errors — the test process is exiting anyway.
      }
    }
  })

  it('streams every notify level to the client by default', async () => {
    const { client, notifications } = await createLoggingClient()
    opened.push(client)

    await client.callTool({ name: 'notify_all', arguments: {} })
    await waitForNotifications(notifications, 4)

    const levels = notifications.map(n => n.level)
    expect(levels).toEqual(['debug', 'info', 'warning', 'error'])

    const loggers = new Set(notifications.map(n => n.logger))
    expect(loggers).toEqual(new Set(['notify-all']))
  })

  it('honors the logging/setLevel filter set by the client', async () => {
    const { client, notifications } = await createLoggingClient()
    opened.push(client)

    await client.setLoggingLevel('warning')
    await client.callTool({ name: 'notify_all', arguments: {} })
    await waitForNotifications(notifications, 2, 1000)

    const levels = notifications.map(n => n.level)
    expect(levels).toEqual(['warning', 'error'])
  })

  it('lets the per-call logger override take precedence over the prefix', async () => {
    const { client, notifications } = await createLoggingClient()
    opened.push(client)

    await client.callTool({ name: 'notify_named', arguments: {} })
    await waitForNotifications(notifications, 2)

    expect(notifications.map(n => n.logger)).toEqual(['default-prefix', 'override-prefix'])
  })

  it('set() and event() populate the request-scoped evlog context', async () => {
    const { client } = await createLoggingClient()
    opened.push(client)

    const result = await client.callTool({ name: 'wide_event', arguments: {} })
    const content = result.content as Array<{ type: string, text?: string }>
    const ctx = JSON.parse(content[0]!.text!)

    expect(ctx.user).toEqual({ id: 'user-42' })
    expect(ctx.feature).toBe('logger-test')
  })

  it('auto-tags `user` and `session` from event.context after middleware', async () => {
    const { client } = await createLoggingClient({ 'x-test-auth': '1' })
    opened.push(client)

    const result = await client.callTool({ name: 'auto_tag', arguments: {} })
    const content = result.content as Array<{ type: string, text?: string }>
    const ctx = JSON.parse(content[0]!.text!)

    expect(ctx.user).toEqual({ id: 'user-99', email: 'op@example.com', name: 'Op' })
    expect(ctx.session).toEqual({ id: 'sess-77' })
    expect(ctx.mcpTool).toBe('auto_tag')
  })

  it('skips user/session tagging when middleware does not set context', async () => {
    const { client } = await createLoggingClient()
    opened.push(client)

    const result = await client.callTool({ name: 'auto_tag', arguments: {} })
    const content = result.content as Array<{ type: string, text?: string }>
    const ctx = JSON.parse(content[0]!.text!)

    expect(ctx.user).toBeUndefined()
    expect(ctx.session).toBeUndefined()
    expect(ctx.mcpTool).toBe('auto_tag')
  })

  it('auto-injects `/mcp` and `/mcp/**` routes derived from evlog.env.service', async () => {
    const { client } = await createLoggingClient()
    opened.push(client)

    const result = await client.callTool({ name: 'inspect_routes', arguments: {} })
    const content = result.content as Array<{ type: string, text?: string }>
    const routes = JSON.parse(content[0]!.text!) as Record<string, { service?: string }>

    expect(routes['/mcp']?.service).toBe('logger-fixture/mcp')
    expect(routes['/mcp/**']?.service).toBe('logger-fixture/mcp')
  })
})
