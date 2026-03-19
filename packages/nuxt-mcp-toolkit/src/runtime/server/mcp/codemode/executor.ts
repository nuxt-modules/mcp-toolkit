import { createServer, type Server } from 'node:http'

export interface CodeModeOptions {
  memoryLimit?: number
  cpuTimeLimitMs?: number
}

export interface ExecuteResult {
  result: unknown
  error?: string
  logs: string[]
}

type DispatchFn = (args: unknown) => Promise<unknown>

const RESULT_PREFIX = '__RESULT__'
const ERROR_PREFIX = '__ERROR__'

async function loadSecureExec() {
  try {
    return await import('secure-exec')
  }
  catch {
    throw new Error(
      '[nuxt-mcp-toolkit] Code Mode requires `secure-exec`. Install it with: npm install secure-exec',
    )
  }
}

function createLocalhostOnlyAdapter() {
  return {
    async fetch(url: string, options: { method?: string, headers?: Record<string, string>, body?: string | null }) {
      const parsed = new URL(url)
      if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
        throw new Error(`Network access restricted to localhost (blocked: ${parsed.hostname})`)
      }

      const resp = await globalThis.fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
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

function startRpcServer(
  fns: Record<string, DispatchFn>,
): Promise<{ server: Server, port: number }> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let body = ''
      for await (const chunk of req) body += chunk

      try {
        const { tool: name, args } = JSON.parse(body) as { tool: string, args: unknown }
        const fn = fns[name]
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
      resolve({ server, port: addr.port })
    })
  })
}

function buildSandboxCode(
  userCode: string,
  toolNames: string[],
  port: number,
): string {
  const proxyMethods = toolNames
    .map(name => `  ${name}: (input) => rpc('${name}', input)`)
    .join(',\n')

  const cleaned = userCode
    .trim()
    .replace(/^```(?:js|javascript|typescript|ts|tsx|jsx)?\s*\n/, '')
    .replace(/\n?```\s*$/, '')
    .trim()

  return `
async function rpc(toolName, args) {
  const res = await fetch('http://127.0.0.1:${port}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tool: toolName, args }),
  });
  const data = JSON.parse(typeof res.text === 'function' ? await res.text() : res.body);
  if (data.error) throw new Error(data.error);
  return data.result;
}

const codemode = {
${proxyMethods}
};

const __fn = async () => {
${cleaned}
};
__fn().then(
  (r) => console.log('${RESULT_PREFIX}' + JSON.stringify(r === undefined ? null : r)),
  (e) => console.error('${ERROR_PREFIX}' + (e && e.message ? e.message : String(e)))
);
`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let runtimeInstance: any = null

export async function execute(
  code: string,
  fns: Record<string, DispatchFn>,
  options?: CodeModeOptions,
): Promise<ExecuteResult> {
  const secureExec = await loadSecureExec()

  if (!runtimeInstance) {
    runtimeInstance = new secureExec.NodeRuntime({
      systemDriver: secureExec.createNodeDriver({
        networkAdapter: createLocalhostOnlyAdapter(),
        permissions: {
          network: () => ({ allow: true }),
        },
      }),
      runtimeDriverFactory: secureExec.createNodeRuntimeDriverFactory(),
      memoryLimit: options?.memoryLimit ?? 64,
      cpuTimeLimitMs: options?.cpuTimeLimitMs ?? 10_000,
    })
  }

  const { server, port } = await startRpcServer(fns)

  try {
    const sandboxCode = buildSandboxCode(code, Object.keys(fns), port)

    let resultJson: string | undefined
    let errorMsg: string | undefined
    const logs: string[] = []

    const execResult = await runtimeInstance.exec(sandboxCode, {
      onStdio: ({ channel, message }: { channel: string, message: string }) => {
        if (channel === 'stdout' && message.startsWith(RESULT_PREFIX)) {
          resultJson = message.slice(RESULT_PREFIX.length)
        }
        else if (channel === 'stderr' && message.startsWith(ERROR_PREFIX)) {
          errorMsg = message.slice(ERROR_PREFIX.length)
        }
        else {
          logs.push(`[${channel}] ${message}`)
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

    return {
      result: resultJson ? JSON.parse(resultJson) : undefined,
      logs,
    }
  }
  finally {
    server.close()
  }
}

export function dispose(): void {
  if (runtimeInstance) {
    runtimeInstance.dispose()
    runtimeInstance = null
  }
}
