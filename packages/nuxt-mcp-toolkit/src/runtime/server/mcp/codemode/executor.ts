import { createServer, type Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import type { CodeModeOptions, ExecuteResult } from './types'
import { normalizeCode } from './normalize-code'

export type { CodeModeOptions, ExecuteResult }
export { normalizeCode }

type DispatchFn = (args: unknown) => Promise<unknown>

const ERROR_PREFIX = '__ERROR__'
const DEFAULT_MAX_RESULT_SIZE = 102_400 // 100KB
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
  catch {
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

interface RpcState {
  server: Server
  port: number
  token: string
  fns: Record<string, DispatchFn>
  onReturn?: (value: unknown) => void
}

let rpcState: RpcState | null = null

function ensureRpcServer(): Promise<RpcState> {
  if (rpcState) return Promise.resolve(rpcState)

  return new Promise((resolve) => {
    const token = randomBytes(32).toString('hex')
    const state: RpcState = { server: null!, port: 0, token, fns: {} }

    const server = createServer(async (req, res) => {
      if (req.headers['x-rpc-token'] !== state.token) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Forbidden' }))
        return
      }

      let body = ''
      for await (const chunk of req) body += chunk

      try {
        const { tool: name, args } = JSON.parse(body) as { tool: string, args: unknown }

        if (name === RETURN_TOOL && state.onReturn) {
          state.onReturn(args)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ result: { ok: true } }))
          return
        }

        const fn = state.fns[name]
        if (!fn) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Unknown tool: ${name}` }))
          return
        }
        const result = await fn(args)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result }))
      }
      catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }))
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      state.server = server
      state.port = addr.port
      rpcState = state
      resolve(state)
    })
  })
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
    body: JSON.stringify({ tool: toolName, args }),
  });
  const data = JSON.parse(typeof res.text === 'function' ? await res.text() : res.body);
  if (data.error) throw new Error(data.error);
  if (data.result && data.result.__toolError) {
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
  cachedProxyKey = key
  return cachedProxyCode
}

function buildSandboxCode(
  userCode: string,
  toolNames: string[],
  port: number,
  token: string,
): string {
  const boilerplate = getProxyBoilerplate(toolNames, port, token)
  const cleaned = normalizeCode(userCode)

  return `${boilerplate}

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
  const secureExec = await loadSecureExec()

  const rpc = await ensureRpcServer()
  rpc.fns = fns

  const toolNames = Object.keys(fns)
  const sandboxCode = buildSandboxCode(code, toolNames, rpc.port, rpc.token)

  // Result delivered via RPC — avoids console.log buffer limits (~4KB)
  let returnedResult: { value: unknown, received: boolean } = { value: undefined, received: false }
  rpc.onReturn = (value: unknown) => {
    returnedResult = { value, received: true }
  }

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
  const logs: string[] = []

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

  rpc.onReturn = undefined

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

export function dispose(): void {
  if (runtimeInstance) {
    runtimeInstance.dispose()
    runtimeInstance = null
  }
  if (rpcState) {
    rpcState.server.close()
    rpcState = null
  }
  secureExecModule = null
  cachedProxyKey = ''
  cachedProxyCode = ''
}
