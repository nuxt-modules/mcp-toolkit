import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { NodeRuntime } from 'secure-exec'
import type { CodeModeOptions, ExecuteResult } from './types'
import { normalizeCode } from './normalize-code'

type SecureExecModule = typeof import('secure-exec')

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
const MCP_BINDING = 'mcp-rpc'
const RETURN_TOOL = '__return__'
const textDecoder = new TextDecoder()

let secureExecModule: SecureExecModule | null = null

async function loadSecureExec(): Promise<SecureExecModule> {
  if (secureExecModule) return secureExecModule
  try {
    secureExecModule = await import('secure-exec')
    return secureExecModule
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] Failed to load secure-exec:', error)
    throw new Error(
      '[nuxt-mcp-toolkit] Code Mode requires `secure-exec`. Install it with: npm install secure-exec',
      { cause: error },
    )
  }
}

interface RpcDispatchPayload {
  tool: string
  args: unknown
  execId: string
}

type RpcDispatchResult
  = | { kind: 'ok', result: unknown }
    | { kind: 'error', status: number, message: string }

async function dispatchRpcCall(
  payload: RpcDispatchPayload,
  state: Pick<RpcState, 'token' | 'executions'>,
  token: string,
): Promise<RpcDispatchResult> {
  if (token !== state.token) {
    return { kind: 'error', status: 403, message: 'Forbidden' }
  }

  const { tool: name, args, execId } = payload

  if (typeof execId !== 'string' || execId.length === 0) {
    return { kind: 'error', status: 400, message: 'Missing execution id' }
  }

  const exec = state.executions.get(execId)
  if (!exec) {
    return { kind: 'error', status: 400, message: `Unknown execution: ${execId}` }
  }

  if (Date.now() > exec.deadlineMs) {
    return { kind: 'error', status: 408, message: 'Execution wall-clock timeout exceeded' }
  }

  if (name === RETURN_TOOL) {
    if (!exec.onReturn) {
      return { kind: 'error', status: 400, message: `Execution cannot accept return value: ${execId}` }
    }
    if (exec.returned) {
      return { kind: 'error', status: 400, message: 'Return value already received for this execution' }
    }

    exec.restoreContext(exec.onReturn, args)
    exec.returned = true
    return { kind: 'ok', result: { ok: true } }
  }

  const fn = exec.fns[name]
  if (!fn) {
    return { kind: 'error', status: 400, message: `Unknown tool: ${name}` }
  }

  exec.rpcCallCount++
  if (exec.rpcCallCount > exec.maxToolCalls) {
    return { kind: 'error', status: 429, message: `Tool call limit exceeded (max ${exec.maxToolCalls})` }
  }

  const result = await exec.restoreContext(fn, args)
  const serialized = JSON.stringify(result)
  if (serialized.length > exec.maxToolResponseSize) {
    return { kind: 'ok', result: truncateResult(result, serialized.length, exec.maxToolResponseSize) }
  }

  return { kind: 'ok', result }
}

async function handleBindingRpc(input: RpcDispatchPayload & { token: string }): Promise<unknown> {
  if (!rpcState) {
    throw new Error('Code mode RPC bridge is not ready')
  }

  const outcome = await dispatchRpcCall(
    { tool: input.tool, args: input.args, execId: input.execId },
    rpcState,
    input.token,
  )

  if (outcome.kind === 'error') {
    throw new Error(outcome.message)
  }

  return outcome.result
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

    const { tool: name, args, execId } = JSON.parse(body) as RpcDispatchPayload

    const outcome = await dispatchRpcCall({ tool: name, args, execId }, state, state.token)
    if (outcome.kind === 'error') {
      sendJson(res, outcome.status, { error: outcome.message })
      return
    }

    sendJson(res, 200, { result: outcome.result })
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] RPC dispatch error:', error)
    sendJson(res, 500, { error: sanitizeErrorMessage(getErrorMessage(error)) })
  }
}

/** RPC server is a singleton; the first successful bind pins `maxRequestBodyBytes` (like `NodeRuntime` options). */
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

function getProxyBoilerplate(toolNames: string[], token: string): string {
  const key = `${token}:${toolNames.join(',')}`
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
import { execFileSync } from 'node:child_process';

async function rpc(toolName, args) {
  const raw = execFileSync('${MCP_BINDING}', ['${MCP_BINDING}', '--json', JSON.stringify({
    token: '${token}',
    tool: toolName,
    args,
    execId: __execId,
  })]);
  const data = JSON.parse(String(raw));
  if (!data.ok) throw new Error(data.error || 'RPC failed');
  const result = data.result;
  if (result && result.__toolError) {
    const err = new Error(result.message);
    err.tool = result.tool;
    err.isToolError = true;
    err.details = result.details;
    throw err;
  }
  return result;
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
  token: string,
  execId: string,
): string {
  const boilerplate = getProxyBoilerplate(toolNames, token)
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

let runtimeInstance: NodeRuntime | null = null

async function ensureRuntime(): Promise<NodeRuntime> {
  if (runtimeInstance) return runtimeInstance

  const secureExec = await loadSecureExec()
  runtimeInstance = await secureExec.NodeRuntime.create({
    permissions: {
      binding: 'allow',
    },
    bindings: {
      [MCP_BINDING]: {
        description: 'Bridge sandboxed code mode calls back to the host MCP tool dispatcher',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            tool: { type: 'string' },
            args: {},
            execId: { type: 'string' },
          },
          required: ['token', 'tool', 'execId'],
        },
        handler: input => handleBindingRpc(input as RpcDispatchPayload & { token: string }),
      },
    },
  })

  return runtimeInstance
}

function appendLog(logs: string[], channel: 'stdout' | 'stderr', message: string): void {
  if (logs.length < MAX_LOG_ENTRIES) {
    logs.push(`[${channel}] ${message}`)
    return
  }

  if (logs.length === MAX_LOG_ENTRIES) {
    logs.push(`... log output truncated at ${MAX_LOG_ENTRIES} entries`)
  }
}

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
    rpc = await ensureRpcServer(options?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES)
    const runtime = await ensureRuntime()

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
    const sandboxCode = buildSandboxCode(code, toolNames, rpc.token, execId)

    // Runtime is a singleton — network permissions and exec timeout are locked
    // from the first call. Call dispose() and re-execute to change them.
    let errorMsg: string | undefined
    const execResult = await runtime.exec(sandboxCode, {
      timeout: options?.cpuTimeLimitMs ?? 10_000,
      onStdout: (chunk) => {
        appendLog(logs, 'stdout', textDecoder.decode(chunk))
      },
      onStderr: (chunk) => {
        const message = textDecoder.decode(chunk)
        if (message.startsWith(ERROR_PREFIX)) {
          errorMsg = message.slice(ERROR_PREFIX.length)
          return
        }
        appendLog(logs, 'stderr', message)
      },
    })

    if (execResult.exitCode !== 0 || errorMsg) {
      return {
        result: undefined,
        error: errorMsg ?? (execResult.stderr.trim() || `Exit code ${execResult.exitCode}`),
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

export async function dispose(): Promise<void> {
  const state = rpcState
  rpcState = null
  rpcStatePromise = null

  if (runtimeInstance) {
    try {
      await runtimeInstance.dispose()
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
