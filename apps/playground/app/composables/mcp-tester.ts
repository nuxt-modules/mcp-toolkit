import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js'

export type ElicitionMode = 'form' | 'url'

export interface PendingElicit {
  id: string
  mode: 'form' | 'url'
  message: string
  url?: string
  requestedSchema?: {
    properties: Record<string, Record<string, unknown>>
    required?: string[]
  }
  resolve: (response: { action: 'accept' | 'decline' | 'cancel', content?: Record<string, unknown> }) => void
}

export interface ToolCallEntry {
  id: string
  tool: string
  args: Record<string, unknown>
  startedAt: number
  finishedAt?: number
  result?: unknown
  error?: string
}

interface ConnectOptions {
  elicitation: 'none' | 'form' | 'form+url'
}

type ToolDescriptor = {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

const DEFAULT_OPTIONS: ConnectOptions = { elicitation: 'form+url' }

export function useMcpTester() {
  const status = ref<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const errorMessage = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const tools = ref<ToolDescriptor[]>([])
  const toolCalls = ref<ToolCallEntry[]>([])
  const pendingElicit = ref<PendingElicit | null>(null)
  const options = ref<ConnectOptions>({ ...DEFAULT_OPTIONS })

  let client: Client | null = null
  let transport: StreamableHTTPClientTransport | null = null

  function reset() {
    toolCalls.value = []
    tools.value = []
    sessionId.value = null
    pendingElicit.value = null
    errorMessage.value = null
  }

  async function disconnect() {
    if (client) {
      try {
        await client.close()
      }
      catch {
        // Already closed / never opened — ignore.
      }
    }
    client = null
    transport = null
    status.value = 'idle'
    reset()
  }

  async function connect(overrides?: Partial<ConnectOptions>) {
    if (status.value === 'connecting') return
    Object.assign(options.value, overrides ?? {})
    await disconnect()
    status.value = 'connecting'
    errorMessage.value = null

    try {
      const capabilities: Record<string, unknown> = {}
      if (options.value.elicitation === 'form') capabilities.elicitation = { form: {} }
      else if (options.value.elicitation === 'form+url') capabilities.elicitation = { form: {}, url: {} }

      client = new Client(
        { name: 'mcp-toolkit-playground-tester', version: '1.0.0' },
        { capabilities },
      )

      if (capabilities.elicitation) {
        client.setRequestHandler(ElicitRequestSchema, (request) => {
          return new Promise((resolve) => {
            const params = request.params as {
              mode?: 'form' | 'url'
              message: string
              url?: string
              requestedSchema?: PendingElicit['requestedSchema']
            }
            pendingElicit.value = {
              id: crypto.randomUUID(),
              mode: params.mode ?? 'form',
              message: params.message,
              url: params.url,
              requestedSchema: params.requestedSchema,
              resolve: (response) => {
                pendingElicit.value = null
                resolve(response)
              },
            }
          })
        })
      }

      transport = new StreamableHTTPClientTransport(new URL('/mcp', window.location.origin))
      await client.connect(transport)
      sessionId.value = transport.sessionId ?? null

      const list = await client.listTools()
      tools.value = list.tools as ToolDescriptor[]
      status.value = 'connected'
    }
    catch (err) {
      status.value = 'error'
      errorMessage.value = err instanceof Error ? err.message : String(err)
      client = null
      transport = null
    }
  }

  async function callTool(name: string, args: Record<string, unknown>) {
    if (!client) throw new Error('Not connected')
    const id = crypto.randomUUID()
    const entry: ToolCallEntry = {
      id,
      tool: name,
      args,
      startedAt: Date.now(),
    }
    toolCalls.value.unshift(entry)

    try {
      const result = await client.callTool({ name, arguments: args })
      entry.result = result
      entry.finishedAt = Date.now()
    }
    catch (err) {
      entry.error = err instanceof Error ? err.message : String(err)
      entry.finishedAt = Date.now()
    }

    toolCalls.value = [...toolCalls.value]
    return entry
  }

  function answerElicit(response: { action: 'accept' | 'decline' | 'cancel', content?: Record<string, unknown> }) {
    pendingElicit.value?.resolve(response)
  }

  function clearCalls() {
    toolCalls.value = []
  }

  return {
    status,
    errorMessage,
    sessionId,
    tools,
    toolCalls,
    pendingElicit,
    options,
    connect,
    disconnect,
    callTool,
    answerElicit,
    clearCalls,
  }
}
