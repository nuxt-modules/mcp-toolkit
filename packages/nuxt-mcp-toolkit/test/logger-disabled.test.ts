import { fileURLToPath } from 'node:url'
import { describe, it, expect, afterAll } from 'vitest'
import { setup, url } from '@nuxt/test-utils/e2e'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

interface CapturedNotification {
  level: string
  data: unknown
  logger?: string
}

function createMcpUrl(path = '/mcp') {
  const baseUrl = url('/')
  const baseUrlObj = new URL(baseUrl)
  const origin = `${baseUrlObj.protocol}//${baseUrlObj.host}`
  return new URL(path, origin)
}

async function waitForNotifications(notifications: CapturedNotification[], expected: number, timeoutMs = 1500) {
  const start = Date.now()
  while (notifications.length < expected) {
    if (Date.now() - start > timeoutMs) break
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

describe('useMcpLogger with mcp.logging: false', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/logger-disabled', import.meta.url)),
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

  it('keeps notify working but throws on set()/event() when observability is disabled', async () => {
    const notifications: CapturedNotification[] = []
    const client = new Client({ name: 'logger-disabled-test', version: '1.0.0' })
    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      notifications.push(notification.params as CapturedNotification)
    })
    await client.connect(new StreamableHTTPClientTransport(createMcpUrl()))
    opened.push(client)

    const result = await client.callTool({ name: 'notify_only', arguments: {} })
    await waitForNotifications(notifications, 1)

    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.level).toBe('info')
    expect(notifications[0]!.logger).toBe('disabled-fixture')

    const content = result.content as Array<{ type: string, text?: string }>
    const payload = JSON.parse(content[0]!.text!)
    expect(payload.setError).toBe('McpObservabilityNotEnabledError')
    expect(payload.eventError).toBe('McpObservabilityNotEnabledError')
  })
})
