import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { CodeModeOptions, ExecuteResult } from './types'
import { normalizeCode } from './normalize-code'

export type { CodeModeOptions, ExecuteResult }
export { normalizeCode }

type DispatchFn = (args: unknown) => Promise<unknown>

const ERROR_PREFIX = '__MCP_EXEC_ERR__'
const DEFAULT_MAX_RESULT_SIZE = 102_400
const DEFAULT_MAX_REQUEST_BODY_BYTES = 1_048_576
const DEFAULT_MAX_TOOL_RESPONSE_SIZE = 1_048_576
const DEFAULT_WALL_TIME_LIMIT_MS = 60_000
const DEFAULT_MAX_TOOL_CALLS = 200
const DEFAULT_MEMORY_LIMIT = 64
const DEFAULT_CPU_TIME_LIMIT_MS = 10_000
const MAX_LOG_ENTRIES = 200
const RETURN_TOOL = '__return__'
const SAFE_IDENTIFIER = /^[\w$]+$/

interface ExecutionContext {
  fns: Record<string, DispatchFn>
  onReturn: (value: unknown) => void
  restoreContext: <R, TArgs extends unknown[]>(fn: (...args: TArgs) => R, ...args: TArgs) => R
  deadlineMs: number
  returned: boolean
  rpcCallCount: number
  maxToolCalls: number
  maxToolResponseSize: number
}

interface RpcSession {
  execId: string
  port: number
  server: Server
  token: string
  maxRequestBodyBytes: number
  context: ExecutionContext
}

interface ActiveSession {
  cleanup: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let secureExecModule: any = null
const activeSessions = new Set<ActiveSession>()
let snapshotWarnLogged = false

async function loadSecureExec() {
  if (secureExecModule) return secureExecModule

  try {
    secureExecModule = await import('secure-exec')
    return secureExecModule
  }
  catch {
    throw new Error(
      '[nuxt-mcp-toolkit] Code Mode requires `secure-exec`. Install it with: npm install secure-exec',
    )
  }
}

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

      const response = await globalThis.fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        redirect: 'error',
      })
      const body = await response.text()
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
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

function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
): void {
  try {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(payload))
  }
  catch (error) {
    if (!res.headersSent) {
      try {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: sanitizeErrorMessage(getErrorMessage(error)) }))
      }
      catch {
        res.destroy()
      }
    }
    else {
      res.destroy()
    }
  }
}

async function handleRpcRequest(
  req: IncomingMessage,
  res: ServerResponse,
  session: Pick<RpcSession, 'context' | 'execId' | 'maxRequestBodyBytes' | 'token'>,
): Promise<void> {
  if (req.headers['x-rpc-token'] !== session.token) {
    sendJson(res, 403, { error: 'Forbidden' })
    return
  }

  try {
    let body = ''
    let byteCount = 0

    for await (const chunk of req) {
      const text = typeof chunk === 'string' ? chunk : (chunk as Buffer).toString()
      byteCount += Buffer.byteLength(text)
      if (byteCount > session.maxRequestBodyBytes) {
        sendJson(res, 413, { error: 'Request body exceeds size limit' })
        return
      }
      body += text
    }

    const { tool, args, execId } = JSON.parse(body) as {
      tool: string
      args: unknown
      execId: string
    }

    if (typeof execId !== 'string' || execId.length === 0) {
      sendJson(res, 400, { error: 'Missing execution id' })
      return
    }

    if (execId !== session.execId) {
      sendJson(res, 400, { error: `Unknown execution: ${execId}` })
      return
    }

    if (Date.now() > session.context.deadlineMs) {
      sendJson(res, 408, { error: 'Execution wall-clock timeout exceeded' })
      return
    }

    if (tool === RETURN_TOOL) {
      if (session.context.returned) {
        sendJson(res, 400, { error: 'Return value already received for this execution' })
        return
      }

      session.context.restoreContext(session.context.onReturn, args)
      session.context.returned = true
      sendJson(res, 200, { result: { ok: true } })
      return
    }

    const fn = session.context.fns[tool]
    if (!fn) {
      sendJson(res, 400, { error: `Unknown tool: ${tool}` })
      return
    }

    session.context.rpcCallCount += 1
    if (session.context.rpcCallCount > session.context.maxToolCalls) {
      sendJson(res, 429, { error: `Tool call limit exceeded (max ${session.context.maxToolCalls})` })
      return
    }

    const result = await session.context.restoreContext(fn, args)
    const serialized = JSON.stringify(result)
    if (serialized.length > session.context.maxToolResponseSize) {
      sendJson(res, 200, { result: truncateResult(result, serialized.length, session.context.maxToolResponseSize) })
      return
    }

    sendJson(res, 200, { result })
  }
  catch (error) {
    sendJson(res, 500, { error: sanitizeErrorMessage(getErrorMessage(error)) })
  }
}

async function createRpcSession(
  context: ExecutionContext,
  maxRequestBodyBytes: number,
): Promise<RpcSession> {
  const execId = randomBytes(8).toString('hex')
  const token = randomBytes(32).toString('hex')

  return await new Promise<RpcSession>((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleRpcRequest(req, res, {
        context,
        execId,
        maxRequestBodyBytes,
        token,
      }).catch(() => {
        if (!res.headersSent) res.destroy()
      })
    })

    const onError = (error: Error) => {
      try {
        server.close()
      }
      catch (closeError) {
        console.warn('[nuxt-mcp-toolkit] server.close() failed during error handling:', closeError)
      }
      reject(error)
    }

    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      const address = server.address() as { port: number }
      resolve({
        execId,
        port: address.port,
        server,
        token,
        maxRequestBodyBytes,
        context,
      })
    })
  })
}

function getProxyBoilerplate(toolNames: string[], port: number, token: string): string {
  for (const name of toolNames) {
    if (!SAFE_IDENTIFIER.test(name)) {
      throw new Error(`[nuxt-mcp-toolkit] Unsafe tool name rejected: "${name}"`)
    }
  }

  const proxyMethods = toolNames
    .map(name => `  ${name}: (input) => rpc('${name}', input)`)
    .join(',\n')

  return `
async function rpc(toolName, args) {
  const res = await fetch('http://127.0.0.1:${port}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rpc-token': '${token}' },
    body: JSON.stringify({ tool: toolName, args, execId: __execId }),
  });
  const data = JSON.parse(typeof res.text === 'function' ? await res.text() : res.body);
  if (data.error) throw new Error(data.error);
  if (data.result && data.result.__mcp_toolkit_error__) {
    const err = new Error(data.result.message);
    err.tool = data.result.tool;
    err.isToolError = true;
    err.details = data.result.details;
    throw err;
  }
  return data.result;
}

const codemode = {
${proxyMethods}
};`
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
  const startedAt = Date.now()
  const logs: string[] = []

  const restoreContext = typeof AsyncLocalStorage.snapshot === 'function'
    ? AsyncLocalStorage.snapshot()
    : (() => {
        if (!snapshotWarnLogged) {
          snapshotWarnLogged = true
          console.warn(
            '[nuxt-mcp-toolkit] AsyncLocalStorage.snapshot unavailable (Node.js <18.16.0). '
            + 'Tool handlers in code mode will not have access to request context (useEvent, auth, etc.).',
          )
        }
        return <R, TArgs extends unknown[]>(fn: (...args: TArgs) => R, ...args: TArgs) => fn(...args)
      })()
  let returnedResult: { received: boolean, value: unknown } = { received: false, value: undefined }
  let rpcSession: RpcSession | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let runtime: any = null
  let wallTimer: ReturnType<typeof setTimeout> | undefined
  let wallTimeExceeded = false

  const activeSession: ActiveSession = {
    cleanup: () => {
      if (wallTimer) {
        clearTimeout(wallTimer)
        wallTimer = undefined
      }
      if (runtime) {
        try {
          runtime.dispose()
        }
        catch (disposeError) {
          console.warn('[nuxt-mcp-toolkit] runtime.dispose() failed during cleanup:', disposeError)
        }
        runtime = null
      }
      if (rpcSession) {
        try {
          rpcSession.server.close()
        }
        catch (closeError) {
          console.warn('[nuxt-mcp-toolkit] server.close() failed during cleanup:', closeError)
        }
        rpcSession = null
      }
    },
  }

  activeSessions.add(activeSession)

  try {
    const secureExec = await loadSecureExec()
    const wallTimeLimitMs = options?.wallTimeLimitMs ?? DEFAULT_WALL_TIME_LIMIT_MS
    const maxRequestBodyBytes = options?.maxRequestBodyBytes ?? DEFAULT_MAX_REQUEST_BODY_BYTES
    const maxToolCalls = options?.maxToolCalls ?? DEFAULT_MAX_TOOL_CALLS
    const maxToolResponseSize = options?.maxToolResponseSize ?? DEFAULT_MAX_TOOL_RESPONSE_SIZE

    const executionContext: ExecutionContext = {
      fns: Object.freeze({ ...fns }),
      onReturn: (value: unknown) => {
        returnedResult = { received: true, value }
      },
      restoreContext,
      deadlineMs: startedAt + wallTimeLimitMs,
      returned: false,
      rpcCallCount: 0,
      maxToolCalls,
      maxToolResponseSize,
    }

    rpcSession = await createRpcSession(executionContext, maxRequestBodyBytes)

    runtime = new secureExec.NodeRuntime({
      systemDriver: secureExec.createNodeDriver({
        networkAdapter: createRpcOnlyAdapter(rpcSession.port),
        permissions: {
          network: () => ({ allow: true }),
        },
      }),
      runtimeDriverFactory: secureExec.createNodeRuntimeDriverFactory(),
      memoryLimit: options?.memoryLimit ?? DEFAULT_MEMORY_LIMIT,
      cpuTimeLimitMs: options?.cpuTimeLimitMs ?? DEFAULT_CPU_TIME_LIMIT_MS,
    })

    const sandboxCode = buildSandboxCode(code, Object.keys(fns), rpcSession.port, rpcSession.token, rpcSession.execId)

    let errorMsg: string | undefined
    wallTimer = setTimeout(() => {
      wallTimeExceeded = true
      try {
        runtime?.dispose()
      }
      catch (disposeError) {
        console.warn('[nuxt-mcp-toolkit] runtime.dispose() failed during wall-time timeout:', disposeError)
      }
    }, wallTimeLimitMs)

    let execResult: { code: number, errorMessage?: string }
    try {
      execResult = await runtime.exec(sandboxCode, {
        onStdio: ({ channel, message }: { channel: string, message: string }) => {
          if (channel === 'stderr' && message.startsWith(ERROR_PREFIX)) {
            errorMsg = message.slice(ERROR_PREFIX.length).trimEnd()
            return
          }

          if (logs.length < MAX_LOG_ENTRIES) {
            logs.push(`[${channel}] ${message}`)
          }
          else if (logs.length === MAX_LOG_ENTRIES) {
            logs.push(`... log output truncated at ${MAX_LOG_ENTRIES} entries`)
          }
        },
      })
    }
    catch (error) {
      if (wallTimeExceeded) {
        return {
          result: undefined,
          error: 'Execution wall-clock timeout exceeded',
          logs,
          durationMs: Date.now() - startedAt,
        }
      }

      throw error
    }
    finally {
      if (wallTimer) {
        clearTimeout(wallTimer)
        wallTimer = undefined
      }
    }

    if (wallTimeExceeded) {
      return {
        result: undefined,
        error: 'Execution wall-clock timeout exceeded',
        logs,
        durationMs: Date.now() - startedAt,
      }
    }

    if (execResult.code !== 0 || errorMsg) {
      return {
        result: undefined,
        error: errorMsg ?? execResult.errorMessage ?? `Exit code ${execResult.code}`,
        logs,
        durationMs: Date.now() - startedAt,
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

    return {
      result,
      logs,
      durationMs: Date.now() - startedAt,
    }
  }
  catch (error) {
    console.error('[nuxt-mcp-toolkit] Execution error:', error)
    return {
      result: undefined,
      error: sanitizeErrorMessage(getErrorMessage(error)),
      logs,
      durationMs: Date.now() - startedAt,
    }
  }
  finally {
    activeSession.cleanup()
    activeSessions.delete(activeSession)
  }
}

export function dispose(): void {
  for (const session of [...activeSessions]) {
    session.cleanup()
    activeSessions.delete(session)
  }

  secureExecModule = null
}
