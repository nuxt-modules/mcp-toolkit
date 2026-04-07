import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dispose, execute } from '../src/runtime/server/mcp/codemode/executor'

afterEach(() => {
  dispose()
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('node:http')
  vi.doUnmock('secure-exec')
})

function createJsonRequest(payload: unknown, token: string) {
  return {
    headers: { 'x-rpc-token': token },
    async* [Symbol.asyncIterator]() {
      yield JSON.stringify(payload)
    },
  }
}

function createMockResponse() {
  let statusCode = 0
  let body = ''

  const res = {
    headersSent: false,
    writableEnded: false,
    writeHead: vi.fn((status: number) => {
      statusCode = status
      res.headersSent = true
      return res
    }),
    end: vi.fn((chunk: string = '') => {
      body = chunk
      res.writableEnded = true
      return res
    }),
    destroy: vi.fn(() => {
      res.writableEnded = true
    }),
  }

  return {
    res,
    get statusCode() {
      return statusCode
    },
    get json() {
      return body ? JSON.parse(body) as Record<string, unknown> : undefined
    },
  }
}

function extractExecMetadata(sandboxCode: string) {
  const token = sandboxCode.match(/'x-rpc-token': '([^']+)'/)?.[1]
  const execId = sandboxCode.match(/const __execId = "([^"]+)";/)?.[1]

  if (!token || !execId) {
    throw new Error('Failed to extract RPC metadata from sandbox code')
  }

  return { token, execId }
}

function createServerMock(portStart = 4300) {
  let requestHandler: ((req: unknown, res: unknown) => void | Promise<void>) | undefined
  let nextPort = portStart

  const createServer = vi.fn((handler: (req: unknown, res: unknown) => void | Promise<void>) => {
    requestHandler = handler
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: nextPort++ })),
    }
    return server
  })

  return {
    createServer,
    getRequestHandler: () => requestHandler,
  }
}

function createSecureExecMock(
  execImpl: (sandboxCode: string, options?: { onStdio?: (event: { channel: string, message: string }) => void }) => Promise<{ code: number, errorMessage?: string }> | { code: number, errorMessage?: string },
) {
  const runtimes: Array<{ exec: ReturnType<typeof vi.fn>, dispose: ReturnType<typeof vi.fn> }> = []

  const NodeRuntime = vi.fn(function MockNodeRuntime() {
    const runtime = {
      exec: vi.fn(execImpl),
      dispose: vi.fn(),
    }
    runtimes.push(runtime)
    return runtime
  })

  return {
    module: {
      NodeRuntime,
      createNodeDriver: vi.fn(() => ({})),
      createNodeRuntimeDriverFactory: vi.fn(() => ({})),
    },
    NodeRuntime,
    runtimes,
  }
}

async function importExecutorWithMocks(options: {
  createServer: (handler: (req: unknown, res: unknown) => void | Promise<void>) => unknown
  secureExecModule: Record<string, unknown>
}) {
  vi.resetModules()
  vi.doMock('node:http', () => ({
    createServer: options.createServer,
  }))
  vi.doMock('secure-exec', () => options.secureExecModule)
  return await import('../src/runtime/server/mcp/codemode/executor')
}

async function invokeHandler(
  handler: (req: unknown, res: unknown) => void | Promise<void>,
  req: unknown,
  res: unknown,
) {
  handler(req, res)
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('executor concurrency', () => {
  it('concurrent execute() calls keep dispatch isolated', async () => {
    const [resultA, resultB] = await Promise.all([
      execute('return await codemode.tool_a();', { tool_a: async () => 'result-A' }),
      execute('return await codemode.tool_b();', { tool_b: async () => 'result-B' }),
    ])

    expect(resultA.error).toBeUndefined()
    expect(resultA.result).toBe('result-A')
    expect(resultB.error).toBeUndefined()
    expect(resultB.result).toBe('result-B')
  })
})

describe('executor AsyncLocalStorage context', () => {
  it('preserves the caller async context during tool dispatch', async () => {
    const als = new AsyncLocalStorage<{ userId: string }>()

    const result = await als.run({ userId: 'user-123' }, () =>
      execute('return await codemode.get_user();', {
        get_user: async () => als.getStore()?.userId,
      }),
    )

    expect(result.error).toBeUndefined()
    expect(result.result).toBe('user-123')
  })
})

describe('executor AsyncLocalStorage fallback', () => {
  it('degrades gracefully when snapshot is unavailable (Node <18.16)', async () => {
    const original = AsyncLocalStorage.snapshot
    try {
      // Simulate Node < 18.16 where snapshot does not exist
      // @ts-expect-error -- deliberately removing static method
      delete AsyncLocalStorage.snapshot

      const serverMock = createServerMock()
      const secureExec = createSecureExecMock(async (code: string) => {
        const { token, execId } = extractExecMetadata(code)
        const handler = serverMock.getRequestHandler()!
        const returnRes = createMockResponse()
        await invokeHandler(handler, createJsonRequest({ tool: '__return__', args: 'fallback-ok', execId }, token), returnRes.res)
        return { code: 0 }
      })

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mod = await importExecutorWithMocks({
        createServer: serverMock.createServer,
        secureExecModule: secureExec.module,
      })

      const result = await mod.execute('return 1;', {})

      expect(result.error).toBeUndefined()
      expect(result.result).toBe('fallback-ok')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('AsyncLocalStorage.snapshot unavailable'),
      )

      // Second call should not warn again
      warnSpy.mockClear()
      const secureExec2 = createSecureExecMock(async (code: string) => {
        const { token, execId } = extractExecMetadata(code)
        const handler = serverMock.getRequestHandler()!
        const returnRes = createMockResponse()
        await invokeHandler(handler, createJsonRequest({ tool: '__return__', args: 'second-ok', execId }, token), returnRes.res)
        return { code: 0 }
      })
      vi.doMock('secure-exec', () => secureExec2.module)
      const result2 = await mod.execute('return 2;', {})

      expect(result2.error).toBeUndefined()
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('AsyncLocalStorage.snapshot unavailable'),
      )

      warnSpy.mockRestore()
    }
    finally {
      AsyncLocalStorage.snapshot = original
    }
  })
})

describe('executor session isolation', () => {
  it('creates independent runtimes with per-execution limits', async () => {
    const { createServer } = createServerMock()
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {}, { memoryLimit: 32, cpuTimeLimitMs: 500 })
    await mod.execute('return 2;', {}, { memoryLimit: 128, cpuTimeLimitMs: 4000 })

    const runtimeCalls = secureExec.NodeRuntime.mock.calls as unknown as Array<[Record<string, unknown>]>

    expect(createServer).toHaveBeenCalledTimes(2)
    expect(secureExec.NodeRuntime).toHaveBeenCalledTimes(2)
    expect(runtimeCalls[0]![0]).toMatchObject({ memoryLimit: 32, cpuTimeLimitMs: 500 })
    expect(runtimeCalls[1]![0]).toMatchObject({ memoryLimit: 128, cpuTimeLimitMs: 4000 })
  })

  it('creates independent RPC servers for concurrent cold starts', async () => {
    const { createServer } = createServerMock()
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await Promise.all([
      mod.execute('return 1;', {}),
      mod.execute('return 2;', {}),
    ])

    expect(createServer).toHaveBeenCalledTimes(2)
  })
})

describe('executor hardening', () => {
  it('enforces wall-clock timeouts per execution', async () => {
    const { createServer } = createServerMock()
    const secureExec = createSecureExecMock(() =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('disposed')), 25)
      }),
    )
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const result = await mod.execute('return 1;', {}, { wallTimeLimitMs: 5 })

    expect(result.error).toBe('Execution wall-clock timeout exceeded')
  })

  it('rejects duplicate return deliveries', async () => {
    const serverMock = createServerMock()
    let sandboxCode = ''
    const firstReturn = createMockResponse()
    const duplicateReturn = createMockResponse()
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      const { token, execId } = extractExecMetadata(code)
      const handler = serverMock.getRequestHandler()!

      await invokeHandler(handler, createJsonRequest({ tool: '__return__', args: 'first', execId }, token), firstReturn.res)
      await invokeHandler(handler, createJsonRequest({ tool: '__return__', args: 'second', execId }, token), duplicateReturn.res)
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    const result = await mod.execute('return "ignored";', {})

    expect(sandboxCode).toContain('__execId')
    expect(result.result).toBe('first')
    expect(firstReturn.statusCode).toBe(200)
    expect(duplicateReturn.statusCode).toBe(400)
  })

  it('rejects invalid RPC tokens', async () => {
    const serverMock = createServerMock()
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token, execId } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(
      serverMock.getRequestHandler()!,
      createJsonRequest({ tool: 'noop', args: null, execId }, `${token}-wrong`),
      response.res,
    )

    expect(response.statusCode).toBe(403)
    expect(response.json?.error).toBe('Forbidden')
  })

  it('rejects unknown execution ids', async () => {
    const serverMock = createServerMock()
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(
      serverMock.getRequestHandler()!,
      createJsonRequest({ tool: 'noop', args: null, execId: 'stale-id' }, token),
      response.res,
    )

    expect(response.statusCode).toBe(400)
    expect(response.json?.error).toContain('Unknown execution')
  })

  it('rejects missing execution ids', async () => {
    const serverMock = createServerMock()
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(
      serverMock.getRequestHandler()!,
      createJsonRequest({ tool: 'noop', args: null, execId: '' }, token),
      response.res,
    )

    expect(response.statusCode).toBe(400)
    expect(response.json?.error).toContain('Missing execution id')
  })

  it('enforces request body size limits', async () => {
    const serverMock = createServerMock()
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {}, { maxRequestBodyBytes: 20 })

    const { token, execId } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(
      serverMock.getRequestHandler()!,
      createJsonRequest({ tool: 'noop', args: 'x'.repeat(200), execId }, token),
      response.res,
    )

    expect(response.statusCode).toBe(413)
    expect(response.json?.error).toContain('Request body exceeds size limit')
  })

  it('enforces tool-call quotas', async () => {
    const serverMock = createServerMock()
    const first = createMockResponse()
    const second = createMockResponse()
    const secureExec = createSecureExecMock(async (code: string) => {
      const { token, execId } = extractExecMetadata(code)
      const handler = serverMock.getRequestHandler()!

      await invokeHandler(handler, createJsonRequest({ tool: 'ping', args: null, execId }, token), first.res)
      await invokeHandler(handler, createJsonRequest({ tool: 'ping', args: null, execId }, token), second.res)
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', { ping: async () => 'pong' }, { maxToolCalls: 1 })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(429)
  })

  it('truncates oversized tool responses', async () => {
    const serverMock = createServerMock()
    const response = createMockResponse()
    const secureExec = createSecureExecMock(async (code: string) => {
      const { token, execId } = extractExecMetadata(code)
      await invokeHandler(
        serverMock.getRequestHandler()!,
        createJsonRequest({ tool: 'big', args: null, execId }, token),
        response.res,
      )
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer: serverMock.createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {
      big: async () => Array.from({ length: 50 }, (_, index) => `item-${index}`),
    }, { maxToolResponseSize: 60 })

    expect(response.statusCode).toBe(200)
    expect(response.json?.result).toMatchObject({ _truncated: true })
  })
})
