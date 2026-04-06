import { AsyncLocalStorage } from 'node:async_hooks'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execute, dispose } from '../src/runtime/server/mcp/codemode/executor'

const mockDisposers: Array<() => void> = []

afterEach(() => {
  for (const disposeMock of mockDisposers.splice(0)) {
    disposeMock()
  }
  dispose()
  vi.restoreAllMocks()
  vi.resetModules()
  vi.doUnmock('node:http')
  vi.doUnmock('secure-exec')
  vi.doUnmock('node:async_hooks')
})

function createJsonRequest(payload: unknown, token: string) {
  return {
    headers: { 'x-rpc-token': token },
    async* [Symbol.asyncIterator]() {
      yield JSON.stringify(payload)
    },
  }
}

function createThrowingRequest(token: string) {
  return {
    headers: { 'x-rpc-token': token },
    [Symbol.asyncIterator]() {
      return {
        next: async () => {
          throw new Error('stream read failed')
        },
      }
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
    get body() {
      return body
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

function createSecureExecMock(
  execImpl: (sandboxCode: string, options?: { onStdio?: (event: { channel: string, message: string }) => void }) => Promise<{ code: number, errorMessage?: string }> | { code: number, errorMessage?: string },
) {
  const runtimeDispose = vi.fn()
  const runtimeExec = vi.fn(execImpl)
  const NodeRuntime = vi.fn(function MockNodeRuntime() {
    return {
      exec: runtimeExec,
      dispose: runtimeDispose,
    }
  })

  return {
    module: {
      NodeRuntime,
      createNodeDriver: vi.fn(() => ({})),
      createNodeRuntimeDriverFactory: vi.fn(() => ({})),
    },
    runtimeDispose,
    runtimeExec,
    NodeRuntime,
  }
}

async function importExecutorWithMocks(options: {
  createServer: (handler: (req: unknown, res: unknown) => void | Promise<void>) => unknown
  secureExecModule: Record<string, unknown>
  asyncHooksModule?: Record<string, unknown>
}) {
  vi.resetModules()
  vi.doMock('node:http', () => ({
    createServer: options.createServer,
  }))
  vi.doMock('secure-exec', () => options.secureExecModule)

  if (options.asyncHooksModule) {
    const asyncHooksModule = options.asyncHooksModule
    vi.doMock('node:async_hooks', () => asyncHooksModule)
  }

  const mod = await import('../src/runtime/server/mcp/codemode/executor')
  mockDisposers.push(() => mod.dispose())
  return mod
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
  it('concurrent execute() calls dispatch to their own function maps', async () => {
    const fnsA: Record<string, (args: unknown) => Promise<unknown>> = {
      tool_a: async () => {
        await new Promise(r => setTimeout(r, 50))
        return 'result-A'
      },
    }

    const fnsB: Record<string, (args: unknown) => Promise<unknown>> = {
      tool_b: async () => {
        await new Promise(r => setTimeout(r, 50))
        return 'result-B'
      },
    }

    const [resultA, resultB] = await Promise.all([
      execute('const r = await codemode.tool_a(); return r;', fnsA),
      execute('const r = await codemode.tool_b(); return r;', fnsB),
    ])

    // Regression: execution-scoped function maps must not be overwritten by concurrent calls.
    expect(resultA.error).toBeUndefined()
    expect(resultA.result).toBe('result-A')
    expect(resultB.error).toBeUndefined()
    expect(resultB.result).toBe('result-B')
  })

  it('concurrent execute() calls return results to the correct caller', { timeout: 15000 }, async () => {
    const fnsA: Record<string, (args: unknown) => Promise<unknown>> = {
      echo: async (args: unknown) => (args as { value: string }).value,
    }

    const fnsB: Record<string, (args: unknown) => Promise<unknown>> = {
      echo: async (args: unknown) => (args as { value: string }).value,
    }

    const [resultA, resultB] = await Promise.all([
      execute('return await codemode.echo({ value: "hello-A" });', fnsA),
      execute('return await codemode.echo({ value: "hello-B" });', fnsB),
    ])

    // Regression: each execution keeps its own return callback and cannot steal a sibling result.
    expect(resultA.result).toBe('hello-A')
    expect(resultB.result).toBe('hello-B')
  })
})

describe('executor AsyncLocalStorage context', () => {
  it('tool dispatch preserves AsyncLocalStorage context from the caller', async () => {
    const als = new AsyncLocalStorage<{ userId: string }>()

    const warmupFns: Record<string, (args: unknown) => Promise<unknown>> = {
      noop: async () => 'ok',
    }
    const warmup = await execute('return await codemode.noop();', warmupFns)
    expect(warmup.error).toBeUndefined()

    const fns: Record<string, (args: unknown) => Promise<unknown>> = {
      get_user: async () => {
        const store = als.getStore()
        if (!store) {
          throw new Error('AsyncLocalStorage context lost — no store available')
        }
        return store.userId
      },
    }

    const result = await als.run({ userId: 'user-123' }, () =>
      execute('return await codemode.get_user();', fns),
    )

    // Regression: the singleton RPC server must restore the caller context per execution.
    expect(result.error).toBeUndefined()
    expect(result.result).toBe('user-123')
  })
})

describe('executor hardening', () => {
  it('shares one RPC server across concurrent cold-start execute() calls', async () => {
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        setTimeout(callback, 0)
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4311 })),
    }
    const createServer = vi.fn(() => server)
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const [first, second] = await Promise.all([
      mod.execute('return 1;', {}),
      mod.execute('return 2;', {}),
    ])

    expect(first.error).toBeUndefined()
    expect(second.error).toBeUndefined()
    expect(createServer).toHaveBeenCalledTimes(1)
    expect(server.listen).toHaveBeenCalledTimes(1)
  })

  it('returns a normal ExecuteResult when RPC server startup fails and retries on the next call', async () => {
    let attempt = 0
    const createServer = vi.fn(() => {
      attempt += 1
      let startupErrorHandler: ((error: Error) => void) | undefined
      const server = {
        once: vi.fn((event: string, handler: (error: Error) => void) => {
          if (event === 'error') startupErrorHandler = handler
          return server
        }),
        off: vi.fn(() => server),
        listen: vi.fn(() => {
          const currentAttempt = attempt
          queueMicrotask(() => {
            startupErrorHandler?.(new Error(`listen failed ${currentAttempt}`))
          })
          return server
        }),
        close: vi.fn(),
        address: vi.fn(() => ({ port: 4400 + attempt })),
      }
      return server
    })
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const first = await mod.execute('return 1;', {})
    const second = await mod.execute('return 2;', {})

    expect(first.error).toContain('listen failed 1')
    expect(second.error).toContain('listen failed 2')
    expect(createServer).toHaveBeenCalledTimes(2)
  })

  it('contains request body stream failures inside the RPC handler', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4312 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await expect(invokeHandler(requestHandler!, createThrowingRequest(token), response.res)).resolves.toBeUndefined()

    expect(response.statusCode).toBe(500)
    expect(response.json?.error).toContain('stream read failed')
  })

  it('returns ExecuteResult errors when the sandbox runtime crashes', async () => {
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4313 })),
    }
    const createServer = vi.fn(() => server)
    const secureExec = createSecureExecMock(async () => {
      throw new Error('runtime crashed')
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const result = await mod.execute('return 1;', {})

    expect(result.error).toContain('runtime crashed')
  })

  it('keeps the first return value when a sandbox tries to return twice', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4314 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    const firstReturn = createMockResponse()
    const duplicateReturn = createMockResponse()
    const secureExec = createSecureExecMock(async (sandboxCode: string) => {
      const { token, execId } = extractExecMetadata(sandboxCode)
      await invokeHandler(requestHandler!, createJsonRequest({ tool: '__return__', args: 'first', execId }, token), firstReturn.res)
      await invokeHandler(requestHandler!, createJsonRequest({ tool: '__return__', args: 'second', execId }, token), duplicateReturn.res)
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const result = await mod.execute('return "ignored";', {})

    expect(result.result).toBe('first')
    expect(firstReturn.statusCode).toBe(200)
    expect(duplicateReturn.statusCode).toBe(400)
    expect(duplicateReturn.json?.error).toContain('Return value already received')
  })

  it('can dispose the singleton state and create a fresh runtime on the next execute()', async () => {
    const servers: Array<{ close: ReturnType<typeof vi.fn> }> = []
    const createServer = vi.fn(() => {
      const server = {
        once: vi.fn(() => server),
        off: vi.fn(() => server),
        listen: vi.fn((_port: number, _host: string, callback: () => void) => {
          callback()
          return server
        }),
        close: vi.fn(),
        address: vi.fn(() => ({ port: 4315 + servers.length })),
      }
      servers.push(server)
      return server
    })
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})
    mod.dispose()
    await mod.execute('return 2;', {})

    expect(createServer).toHaveBeenCalledTimes(2)
    expect(secureExec.NodeRuntime).toHaveBeenCalledTimes(2)
    expect(servers[0]!.close).toHaveBeenCalledTimes(1)
  })

  it('rejects requests with invalid RPC token', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4320 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(requestHandler!, createJsonRequest({ tool: 'test', args: null, execId: 'abc' }, token + 'wrong'), response.res)

    expect(response.statusCode).toBe(403)
    expect(response.json?.error).toBe('Forbidden')
  })

  it('rejects requests with unknown execId', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4321 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    // After execute() completes, the execId is cleaned up from the map
    await invokeHandler(requestHandler!, createJsonRequest({ tool: 'test', args: null, execId: 'stale-id' }, token), response.res)

    expect(response.statusCode).toBe(400)
    expect(response.json?.error).toContain('Unknown execution')
  })

  it('rejects requests with missing execId', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4322 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {})

    const { token } = extractExecMetadata(sandboxCode)
    const response = createMockResponse()
    await invokeHandler(requestHandler!, createJsonRequest({ tool: 'test', args: null, execId: '' }, token), response.res)

    expect(response.statusCode).toBe(400)
    expect(response.json?.error).toContain('Missing execution id')
  })

  it('returns 413 when RPC request body exceeds size limit', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4323 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    let sandboxCode = ''
    const secureExec = createSecureExecMock(async (code: string) => {
      sandboxCode = code
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    // Use a tiny maxRequestBodyBytes to trigger the limit easily
    await mod.execute('return 1;', {}, { maxRequestBodyBytes: 50 })

    const { token } = extractExecMetadata(sandboxCode)
    const largePayload = { tool: 'test', args: 'x'.repeat(200), execId: 'abc' }
    const response = createMockResponse()
    await invokeHandler(requestHandler!, createJsonRequest(largePayload, token), response.res)

    expect(response.statusCode).toBe(413)
    expect(response.json?.error).toContain('size limit')
  })

  it('returns 408 when wall-clock deadline is exceeded', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4324 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    const secureExec = createSecureExecMock(async (code: string) => {
      // Simulate a long-running sandbox that makes an RPC call after the deadline
      const { token, execId } = extractExecMetadata(code)
      // Wait to ensure deadline passes
      await new Promise(r => setTimeout(r, 50))
      const toolResponse = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'slow_tool', args: null, execId }, token), toolResponse.res)
      expect(toolResponse.statusCode).toBe(408)
      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    // Wall time of 1ms — will expire almost immediately
    await mod.execute('return await codemode.slow_tool();', { slow_tool: async () => 'ok' }, { wallTimeLimitMs: 1 })
  })

  it('returns 429 when RPC call quota is exceeded', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4325 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    const secureExec = createSecureExecMock(async (code: string) => {
      const { token, execId } = extractExecMetadata(code)

      // Call 1 — should succeed
      const r1 = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'my_tool', args: null, execId }, token), r1.res)
      expect(r1.statusCode).toBe(200)

      // Call 2 — should succeed
      const r2 = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'my_tool', args: null, execId }, token), r2.res)
      expect(r2.statusCode).toBe(200)

      // Call 3 — should be rejected (quota is 2)
      const r3 = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'my_tool', args: null, execId }, token), r3.res)
      expect(r3.statusCode).toBe(429)
      expect(r3.json?.error).toContain('Tool call limit exceeded')

      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', { my_tool: async () => 'ok' }, { maxToolCalls: 2 })
  })

  it('truncates oversized tool RPC responses', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4326 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    const secureExec = createSecureExecMock(async (code: string) => {
      const { token, execId } = extractExecMetadata(code)

      const response = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'big_tool', args: null, execId }, token), response.res)
      expect(response.statusCode).toBe(200)
      expect(response.json?.result).toHaveProperty('_truncated', true)

      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    const bigArray = Array.from({ length: 10000 }, (_, i) => `item-${i}`)
    await mod.execute('return 1;', { big_tool: async () => bigArray }, { maxToolResponseSize: 500 })
  })

  it('sanitizes file paths in error messages returned to the sandbox', async () => {
    let requestHandler: ((req: unknown, res: unknown) => Promise<void> | void) | undefined
    const server = {
      once: vi.fn(() => server),
      off: vi.fn(() => server),
      listen: vi.fn((_port: number, _host: string, callback: () => void) => {
        callback()
        return server
      }),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4327 })),
    }
    const createServer = vi.fn((handler: (req: unknown, res: unknown) => Promise<void> | void) => {
      requestHandler = handler
      return server
    })
    const secureExec = createSecureExecMock(async (code: string) => {
      const { token, execId } = extractExecMetadata(code)

      const response = createMockResponse()
      await invokeHandler(requestHandler!, createJsonRequest({ tool: 'fail_tool', args: null, execId }, token), response.res)
      expect(response.statusCode).toBe(500)
      // The path should be sanitized
      expect(response.json?.error).toContain('[path]')
      expect(response.json?.error).not.toContain('/Users/dev/project/src/secret.ts')

      return { code: 0 }
    })
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
    })

    await mod.execute('return 1;', {
      fail_tool: async () => { throw new Error('Failed at /Users/dev/project/src/secret.ts:42') },
    })
  })

  it('returns a clear error when AsyncLocalStorage.snapshot() is unavailable', async () => {
    const AsyncLocalStorageWithoutSnapshot = function AsyncLocalStorageWithoutSnapshot() {}
    Object.assign(AsyncLocalStorageWithoutSnapshot, { snapshot: undefined })

    const createServer = vi.fn(() => ({
      once: vi.fn(),
      off: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
      address: vi.fn(() => ({ port: 4316 })),
    }))
    const secureExec = createSecureExecMock(async () => ({ code: 0 }))
    const mod = await importExecutorWithMocks({
      createServer,
      secureExecModule: secureExec.module,
      asyncHooksModule: { AsyncLocalStorage: AsyncLocalStorageWithoutSnapshot },
    })

    const result = await mod.execute('return 1;', {})

    expect(result.error).toContain('Node.js >=18.16.0')
    expect(createServer).not.toHaveBeenCalled()
  })
})
