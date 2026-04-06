import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { CodeModeOptions, ExecuteResult } from './types'
import { normalizeCode } from './normalize-code'

export type { CodeModeOptions, ExecuteResult }
export { normalizeCode }

type DispatchFn = (args: unknown) => Promise<unknown>

const ERROR_PREFIX = '__ERROR__'
const DEFAULT_MAX_RESULT_SIZE = 102_400 // 100KB
const DEFAULT_MAX_REQUEST_BODY_BYTES = 1_048_576 // 1MB
const DEFAULT_MAX_TOOL_RESPONSE_SIZE = 1_048_576 // 1MB
const DEFAULT_WALL_TIME_LIMIT_MS = 60_000 // 60s
const DEFAULT_MAX_TOOL_CALLS = 200
const MAX_LOG_ENTRIES = 200
const RETURN_TOOL = '__return__'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let secureExecModule: any = null

async function loadSecureExec() {
  if (secureExecModule) return secureExecModule
  try {
    secureExecModule = await import('secure-exec')
    return secureExecModule
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] Failed to load secure-exec:', error)
    throw new Error(
      '[nuxt-mcp-toolkit] Code Mode requires `secure-exec`. Install it with: npm install secure-exec',
    )
  }
}

function createRpcOnlyAdapter(allowedPort: number) {
  return {
    async fetch(url: string, options: { method?: string, headers?: Record<string, string>, body?: string | null }) {
      const parsed = new URL(url)
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        throw new Error(`Network access restricted to RPC server (blocked host: ${parsed.hostname})`)
      }
      if (Number(parsed.port) !== allowedPort) {
        throw new Error(`Network access restricted to RPC server (blocked port: ${parsed.port})`)
      }

      const resp = await globalThis.fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        redirect: 'error',
      })
      const body = await resp.text()
      const headers: Record<string, string> = {}
      resp.headers.forEach((v, k) => {
        headers[k] = v
      })

      return {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText,
        headers,
        body,
        url,
        redirected: false,
      }
    },

    async dnsLookup() {
      return { error: 'DNS not available in code mode', code: 'ENOSYS' }
    },

    async httpRequest() {
      throw new Error('Raw HTTP not available in code mode')
    },
  }
}

interface ExecutionContext {
  fns: Record<string, DispatchFn>
  onReturn?: (value: unknown) => void
  returned: boolean
  /**
   * Function returned by AsyncLocalStorage.snapshot() that re-enters the
   * async context active when execute() was called, before invoking the
   * provided callback.
   */
  restoreContext: <R, TArgs extends unknown[]>(fn: (...args: TArgs) => R, ...args: TArgs) => R
  deadlineMs: number
  rpcCallCount: number
  maxToolCalls: number
  maxToolResponseSize: number
}

interface RpcState {
  server: Server
  readonly port: number
  readonly token: string
  readonly executions: Map<string, ExecutionContext>
  readonly maxRequestBodyBytes: number
}

let rpcState: RpcState | null = null
let rpcStatePromise: Promise<RpcState> | null = null

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/(?:\/[\w.][-\w.]*)+\.\w+/g, '[path]')
    .replace(/(?:[A-Z]:\\[\w.][-\w.\\]*)+/g, '[path]')
    .replace(/\n\s+at .+/g, '')
    .slice(0, 500)
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
): void {
  let serialized: string
  try {
    serialized = JSON.stringify(payload)
  }
  catch (error) {
    console.warn('[nuxt-mcp-toolkit] Failed to serialize RPC response:', getErrorMessage(error))
    if (res.headersSent) {
      res.destroy()
      return
    }
    serialized = JSON.stringify({ error: 'Failed to serialize RPC response' })
    status = 500
  }

  try {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(serialized)
  }
  catch (error) {
    console.warn('[nuxt-mcp-toolkit] Failed to write RPC response:', getErrorMessage(error))
    if (res.headersSent) {
      res.destroy()
      return
    }

    try {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to send RPC response' }))
    }
    catch (innerError) {
      console.warn('[nuxt-mcp-toolkit] RPC response write failed, destroying socket:', getErrorMessage(innerError))
      res.destroy()
    }
  }
}

async function handleRpcRequest(
  req: IncomingMessage,
  res: ServerResponse,
  state: Pick<RpcState, 'token' | 'executions' | 'maxRequestBodyBytes'>,
): Promise<void> {
  if (req.headers['x-rpc-token'] !== state.token) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }

  try {
    let body = ''
    let byteCount = 0
    for await (const chunk of req) {
      const str = typeof chunk === 'string' ? chunk : (chunk as Buffer).toString()
      byteCount += Buffer.byteLength(str)
      if (byteCount > state.maxRequestBodyBytes) {
        sendJson(res, 413, { error: 'Request body exceeds size limit' })
        return
      }
      body += str
    }

    const { tool: name, args, execId } = JSON.parse(body) as {
      tool: string
      args: unknown
      execId: string
    }

    if (typeof execId !== 'string' || execId.length === 0) {
      sendJson(res, 400, { error: 'Missing execution id' })
      return
    }

    const exec = state.executions.get(execId)
    if (!exec) {
      sendJson(res, 400, { error: `Unknown execution: ${execId}` })
      return
    }

    if (Date.now() > exec.deadlineMs) {
      sendJson(res, 408, { error: 'Execution wall-clock timeout exceeded' })
      return
    }

    if (name === RETURN_TOOL) {
      if (!exec.onReturn) {
        sendJson(res, 400, { error: `Execution cannot accept return value: ${execId}` })
        return
      }
      if (exec.returned) {
        sendJson(res, 400, { error: 'Return value already received for this execution' })
        return
      }

      exec.restoreContext(exec.onReturn, args)
      exec.returned = true
      sendJson(res, 200, { result: { ok: true } })
      return
    }

    const fn = exec.fns[name]
    if (!fn) {
      sendJson(res, 400, { error: `Unknown tool: ${name}` })
      return
    }

    exec.rpcCallCount++
    if (exec.rpcCallCount > exec.maxToolCalls) {
      sendJson(res, 429, { error: `Tool call limit exceeded (max ${exec.maxToolCalls})` })
      return
    }

    const result = await exec.restoreContext(fn, args)
    const serialized = JSON.stringify(result)
    if (serialized.length > exec.maxToolResponseSize) {
      sendJson(res, 200, { result: truncateResult(result, serialized.length, exec.maxToolResponseSize) })
    }
    else {
      sendJson(res, 200, { result })
    }
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] RPC dispatch error:', error)
    sendJson(res, 500, { error: sanitizeErrorMessage(getErrorMessage(error)) })
  }
}

function ensureRpcServer(maxRequestBodyBytes: number): Promise<RpcState> {
  if (rpcState) return Promise.resolve(rpcState)
  if (rpcStatePromise) return rpcStatePromise

  rpcStatePromise = new Promise((resolve, reject) => {
    const token = randomBytes(32).toString('hex')
    const executions = new Map<string, ExecutionContext>()
    const stateRef = { token, executions, maxRequestBodyBytes }
    const server = createServer((req, res) => {
      handleRpcRequest(req, res, stateRef).catch((error) => {
        console.error('[nuxt-mcp-toolkit] Unhandled RPC error:', error)
        if (!res.headersSent) {
          try {
            sendJson(res, 500, { error: 'Internal server error' })
          }
          catch {
            res.destroy()
          }
        }
      })
    })

    const onError = (error: Error) => {
      rpcStatePromise = null
      console.error('[nuxt-mcp-toolkit] RPC server startup failed:', error)
      try {
        server.close()
      }
      catch (closeError) {
        console.warn('[nuxt-mcp-toolkit] Failed to close RPC server during error cleanup:', getErrorMessage(closeError))
      }
      reject(error)
    }

    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      server.off('error', onError)
      const state: RpcState = { server, port: addr.port, token, executions, maxRequestBodyBytes }
      rpcState = state
      resolve(state)
    })
  })

  return rpcStatePromise
}

let cachedProxyKey = ''
let cachedProxyCode = ''

const SAFE_IDENTIFIER = /^[\w$]+$/

function getProxyBoilerplate(toolNames: string[], port: number, token: string): string {
  const key = `${port}:${token}:${toolNames.join(',')}`
  if (key === cachedProxyKey) return cachedProxyCode

  for (const name of toolNames) {
    if (!SAFE_IDENTIFIER.test(name)) {
      throw new Error(`[nuxt-mcp-toolkit] Unsafe tool name rejected: "${name}"`)
    }
  }

  const proxyMethods = toolNames
    .map(name => `  ${name}: (input) => rpc('${name}', input)`)
    .join(',\n')

  cachedProxyCode = `
async function rpc(toolName, args) {
  const res = await fetch('http://127.0.0.1:${port}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rpc-token': '${token}' },
    body: JSON.stringify({ tool: toolName, args, execId: __execId }),
  });
  const data = JSON.parse(typeof res.text === 'function' ? await res.text() : res.body);
  if (data.error) throw new Error(data.error);
  return data.result;
}

const codemode = {
${proxyMethods}
};`
  cachedProxyKey = key
  return cachedProxyCode
}

function buildSandboxCode(
  userCode: string,
  toolNames: string[],
  port: number,
  token: string,
  execId: string,
): string {
  const boilerplate = getProxyBoilerplate(toolNames, port, token)
  const cleaned = normalizeCode(userCode)

  return `const __execId = ${JSON.stringify(execId)};
${boilerplate}

const __fn = async () => {
${cleaned}
};
__fn().then(
  (r) => rpc('${RETURN_TOOL}', r === undefined ? null : r),
  (e) => console.error('${ERROR_PREFIX}' + (e && e.message ? e.message : String(e)))
).catch(
  (e) => console.error('${ERROR_PREFIX}' + 'Result delivery failed: ' + (e && e.message ? e.message : String(e)))
);
`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtimeInstance: any = null

function truncateResult(value: unknown, totalSize: number, maxSize: number): Record<string, unknown> {
  if (Array.isArray(value)) {
    const keepCount = Math.max(1, Math.floor(value.length * maxSize / totalSize))
    return {
      _truncated: true,
      _totalItems: value.length,
      _shownItems: keepCount,
      _message: `Result truncated: ${totalSize} bytes exceeds ${maxSize} byte limit. Showing ${keepCount}/${value.length} items.`,
      data: value.slice(0, keepCount),
    }
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value)
    const keepCount = Math.max(1, Math.floor(keys.length * maxSize / totalSize))
    const partial: Record<string, unknown> = {}
    for (const key of keys.slice(0, keepCount)) {
      partial[key] = (value as Record<string, unknown>)[key]
    }
    return {
      _truncated: true,
      _totalKeys: keys.length,
      _shownKeys: keepCount,
      _message: `Result truncated: ${totalSize} bytes exceeds ${maxSize} byte limit. Showing ${keepCount}/${keys.length} keys.`,
      data: partial,
    }
  }
  return {
    _truncated: true,
    _totalBytes: totalSize,
    _message: `Result truncated: ${totalSize} bytes exceeds ${maxSize} byte limit.`,
    data: String(value).slice(0, maxSize),
  }
}

export async function execute(
  code: string,
  fns: Record<string, DispatchFn>,
  options?: CodeModeOptions,
): Promise<ExecuteResult> {
  const logs: string[] = []

  if (typeof AsyncLocalStorage.snapshot !== 'function') {
    return {
      result: undefined,
      error: '[nuxt-mcp-toolkit] Code Mode requires Node.js >=18.16.0 (AsyncLocalStorage.snapshot is unavailable).',
      logs,
    }
  }

  let rpc: RpcState | undefined
  let execId: string | undefined
  let returnedResult: { value: unknown, received: boolean } = { value: undefined, received: false }

  try {
    const secureExec = await loadSecureExec()
    rpc = await ensureRpcServer(options?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES)

    execId = randomBytes(8).toString('hex')
    const restoreContext = AsyncLocalStorage.snapshot()

    // Result delivered via RPC per execution, avoiding console.log buffer limits (~4KB)
    rpc.executions.set(execId, {
      fns: Object.freeze({ ...fns }),
      onReturn: (value: unknown) => {
        returnedResult = { value, received: true }
      },
      returned: false,
      restoreContext,
      deadlineMs: Date.now() + (options?.wallTimeLimitMs ?? DEFAULT_WALL_TIME_LIMIT_MS),
      rpcCallCount: 0,
      maxToolCalls: options?.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS,
      maxToolResponseSize: options?.maxToolResponseSize ?? DEFAULT_MAX_TOOL_RESPONSE_SIZE,
    })

    const toolNames = Object.keys(fns)
    const sandboxCode = buildSandboxCode(code, toolNames, rpc.port, rpc.token, execId)

    // Runtime is a singleton — memoryLimit and cpuTimeLimitMs are locked
    // from the first call. Call dispose() and re-execute to change them.
    if (!runtimeInstance) {
      runtimeInstance = new secureExec.NodeRuntime({
        systemDriver: secureExec.createNodeDriver({
          networkAdapter: createRpcOnlyAdapter(rpc.port),
          permissions: {
            network: () => ({ allow: true }),
          },
        }),
        runtimeDriverFactory: secureExec.createNodeRuntimeDriverFactory(),
        memoryLimit: options?.memoryLimit ?? 64,
        cpuTimeLimitMs: options?.cpuTimeLimitMs ?? 10_000,
      })
    }

    let errorMsg: string | undefined
    const execResult = await runtimeInstance.exec(sandboxCode, {
      onStdio: ({ channel, message }: { channel: string, message: string }) => {
        if (channel === 'stderr' && message.startsWith(ERROR_PREFIX)) {
          errorMsg = message.slice(ERROR_PREFIX.length)
        }
        else if (logs.length < MAX_LOG_ENTRIES) {
          logs.push(`[${channel}] ${message}`)
        }
        else if (logs.length === MAX_LOG_ENTRIES) {
          logs.push(`... log output truncated at ${MAX_LOG_ENTRIES} entries`)
        }
      },
    })

    if (execResult.code !== 0 || errorMsg) {
      return {
        result: undefined,
        error: errorMsg ?? execResult.errorMessage ?? `Exit code ${execResult.code}`,
        logs,
      }
    }

    let result: unknown
    if (returnedResult.received) {
      const maxSize = options?.maxResultSize ?? DEFAULT_MAX_RESULT_SIZE
      const serialized = JSON.stringify(returnedResult.value)

      if (serialized.length <= maxSize) {
        result = returnedResult.value
      }
      else {
        result = truncateResult(returnedResult.value, serialized.length, maxSize)
      }
    }

    return { result, logs }
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] Execution error:', error)
    return {
      result: undefined,
      error: sanitizeErrorMessage(getErrorMessage(error)),
      logs,
    }
  }
  finally {
    if (rpc && execId) {
      rpc.executions.delete(execId)
    }
  }
}

export function dispose(): void {
  const state = rpcState
  rpcState = null
  rpcStatePromise = null

  if (runtimeInstance) {
    try {
      runtimeInstance.dispose()
    }
    catch (error) {
      console.warn('[nuxt-mcp-toolkit] Error disposing runtime:', getErrorMessage(error))
    }
    runtimeInstance = null
  }
  if (state) {
    state.executions.clear()
    try {
      state.server.close()
    }
    catch (error) {
      console.warn('[nuxt-mcp-toolkit] Error closing RPC server during dispose:', getErrorMessage(error))
    }
  }
  secureExecModule = null
  cachedProxyKey = ''
  cachedProxyCode = ''
}
