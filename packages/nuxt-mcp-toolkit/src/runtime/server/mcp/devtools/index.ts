import { logger } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import type { ModuleOptions } from '../../../../module'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

const log = logger.withTag('@nuxtjs/mcp-toolkit')

// Constants
const INSPECTOR_TIMEOUT = 15000
const HEALTH_CHECK_TIMEOUT = 3000
const INSPECTOR_DEFAULT_CLIENT_PORT = 6274
const INSPECTOR_DEFAULT_SERVER_PORT = 6277
const HEALTH_CHECK_RETRIES = 5
const MAX_BUFFER_SIZE = 10240

const ERROR_PATTERNS = [
  /PORT IS IN USE/i,
  /EADDRINUSE/i,
  /address already in use/i,
  /port \d+ is already in use/i,
]

let inspectorProcess: ChildProcess | null = null
let inspectorUrl: string | null = null
let isReady = false
let promise: Promise<void> | null = null
let proxyAuthToken: string | null = null

function resetState() {
  inspectorProcess = null
  inspectorUrl = null
  isReady = false
  proxyAuthToken = null
}

function buildInspectorUrl(baseUrl: string, mcpServerUrl: string): string {
  const urlObj = new URL(baseUrl)
  urlObj.searchParams.set('transport', 'streamable-http')
  urlObj.searchParams.set('serverUrl', mcpServerUrl)
  if (proxyAuthToken) {
    urlObj.searchParams.set('MCP_PROXY_AUTH_TOKEN', proxyAuthToken)
  }
  return urlObj.toString()
}

function extractProxyToken(text: string): string | null {
  const match = text.match(/Session token:\s+([a-f0-9]+)/i)
  return match?.[1] ?? null
}

function limitBuffer(buffer: string, maxSize: number): string {
  if (buffer.length <= maxSize) {
    return buffer
  }
  return buffer.slice(-maxSize)
}

function getInspectorClientPort(): number {
  if (process.env.CLIENT_PORT) {
    const port = Number.parseInt(process.env.CLIENT_PORT, 10)
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port
    }
  }
  if (process.env.MCP_INSPECTOR_PORT) {
    const port = Number.parseInt(process.env.MCP_INSPECTOR_PORT, 10)
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port
    }
  }
  return INSPECTOR_DEFAULT_CLIENT_PORT
}

function getInspectorServerPort(): number {
  if (process.env.SERVER_PORT) {
    const port = Number.parseInt(process.env.SERVER_PORT, 10)
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port
    }
  }
  return INSPECTOR_DEFAULT_SERVER_PORT
}

function buildInspectorBaseUrl(port: number): string {
  return `http://localhost:${port}`
}

function containsError(text: string): boolean {
  return ERROR_PATTERNS.some(pattern => pattern.test(text))
}

async function waitForInspectorReady(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < HEALTH_CHECK_RETRIES; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.status >= 200 && response.status < 400) {
        if (!proxyAuthToken) {
          const text = await response.text().catch(() => '')
          const token = extractProxyToken(text)
          if (token) {
            proxyAuthToken = token
          }
        }
        return true
      }
    }
    catch {
      if (attempt < HEALTH_CHECK_RETRIES - 1) {
        continue
      }
    }
  }

  return false
}

function cleanupListeners(
  process: ChildProcess,
  handlers: {
    stdout?: (data: Buffer) => void
    stderr?: (data: Buffer) => void
    error?: (error: Error) => void
    exit?: (code: number | null) => void
  },
): void {
  if (handlers.stdout && process.stdout) {
    process.stdout.removeListener('data', handlers.stdout)
  }
  if (handlers.stderr && process.stderr) {
    process.stderr.removeListener('data', handlers.stderr)
  }
  if (handlers.error) {
    process.removeListener('error', handlers.error)
  }
  if (handlers.exit) {
    process.removeListener('exit', handlers.exit)
  }
}

async function launchMcpInspector(nuxt: Nuxt, options: ModuleOptions): Promise<void> {
  if (inspectorProcess) {
    return
  }

  const mcpServerUrl = `http://localhost:${nuxt.options.devServer?.port || 3000}${options.route || '/mcp'}`
  const inspectorClientPort = getInspectorClientPort()
  const inspectorServerPort = getInspectorServerPort()
  const inspectorBaseUrl = buildInspectorBaseUrl(inspectorClientPort)

  log.info('🚀 Launching MCP Inspector...')

  try {
    const env = {
      ...globalThis.process.env,
      MCP_AUTO_OPEN_ENABLED: 'false',
      CLIENT_PORT: String(inspectorClientPort),
      SERVER_PORT: String(inspectorServerPort),
    }

    inspectorProcess = spawn('npx', [
      '-y',
      '@modelcontextprotocol/inspector',
      'streamable-http',
      mcpServerUrl,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    })

    const childProcess = inspectorProcess
    let stdoutBuffer = ''
    let stderrBuffer = ''
    let isResolved = false
    let timeoutId: NodeJS.Timeout | null = null

    await new Promise<void>((res, rej) => {
      const resolve = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        cleanupListeners(childProcess, handlers)
        res()
      }
      const reject = (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        cleanupListeners(childProcess, handlers)
        resetState()
        rej(error)
      }

      const handlers = {
        stdout: (data: Buffer) => {
          const text = data.toString()
          stdoutBuffer += text
          stdoutBuffer = limitBuffer(stdoutBuffer, MAX_BUFFER_SIZE)

          if (!proxyAuthToken) {
            const token = extractProxyToken(text)
            if (token) {
              proxyAuthToken = token
            }
          }
        },
        stderr: (data: Buffer) => {
          const text = data.toString()
          stderrBuffer += text
          stderrBuffer = limitBuffer(stderrBuffer, MAX_BUFFER_SIZE)

          if (!proxyAuthToken) {
            const token = extractProxyToken(text)
            if (token) {
              proxyAuthToken = token
            }
          }

          if (containsError(stderrBuffer) && !isResolved) {
            isResolved = true
            log.error('❌ MCP Inspector port is already in use')
            handleError(
              new Error('MCP Inspector port is already in use. Please stop any running Inspector instances.'),
              timeoutId,
              reject,
            )
          }
        },
        error: (error: Error) => {
          if (!isResolved) {
            isResolved = true
            log.error(`❌ Failed to start inspector process: ${error.message}`)
            handleError(error, timeoutId, reject)
          }
        },
        exit: (code: number | null) => {
          if (!isResolved) {
            isResolved = true
            const errorOutput = stderrBuffer || stdoutBuffer || 'No output'
            const lastLines = errorOutput.split('\n').slice(-10).join('\n')
            const errorMessage = code !== 0 && code !== null
              ? `MCP Inspector exited with code ${code}. Last output:\n${lastLines}`
              : `MCP Inspector exited unexpectedly. Last output:\n${lastLines}`

            log.error(`❌ Inspector process exited with code ${code ?? 'null'}`)
            handleError(new Error(errorMessage), timeoutId, reject)
          }
        },
      }

      childProcess.stdout?.on('data', handlers.stdout)
      childProcess.stderr?.on('data', handlers.stderr)
      childProcess.on('error', handlers.error)
      childProcess.on('exit', handlers.exit)

      const startHealthCheck = async () => {
        for (let delay = 500; delay <= 3000; delay += 500) {
          await new Promise(res => setTimeout(res, delay))

          if (isResolved) {
            return
          }

          if (childProcess.killed || childProcess.exitCode !== null) {
            if (!isResolved) {
              isResolved = true
              const errorOutput = stderrBuffer || stdoutBuffer || 'Process exited unexpectedly'
              log.error(`❌ Inspector process exited before health check (code: ${childProcess.exitCode})`)
              handleError(
                new Error(`MCP Inspector process exited before health check. Output:\n${errorOutput.slice(0, 500)}`),
                timeoutId,
                reject,
              )
            }
            return
          }

          const isReady = await waitForInspectorReady(inspectorBaseUrl)
          if (isReady && !isResolved) {
            isResolved = true
            log.success(`✅ MCP Inspector is ready at ${inspectorBaseUrl}`)
            handleUrlDetected(inspectorBaseUrl, mcpServerUrl, timeoutId, resolve)
            return
          }
        }

        if (!isResolved) {
          log.warn('⚠️ Inspector health check failed')
        }
      }

      startHealthCheck().catch((error) => {
        if (!isResolved) {
          isResolved = true
          handleError(error, timeoutId, reject)
        }
      })

      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          const errorOutput = stderrBuffer || stdoutBuffer || 'Unknown error'
          const lastLines = errorOutput.split('\n').slice(-10).join('\n')
          log.error(`❌ Inspector startup timeout after ${INSPECTOR_TIMEOUT}ms`)
          handleError(
            new Error(`MCP Inspector failed to start - timeout after ${INSPECTOR_TIMEOUT}ms.\nLast output:\n${lastLines}`),
            null,
            reject,
          )
        }
      }, INSPECTOR_TIMEOUT)
    })
  }
  catch (error) {
    log.error('❌ Failed to launch MCP Inspector:', error)
    resetState()
    throw error
  }
}

function handleUrlDetected(
  baseUrl: string,
  mcpServerUrl: string,
  timeoutId: NodeJS.Timeout | null,
  resolve: () => void,
): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }

  const builtUrl = buildInspectorUrl(baseUrl, mcpServerUrl)
  inspectorUrl = builtUrl
  isReady = true
  resolve()
}

function handleError(
  error: Error,
  timeoutId: NodeJS.Timeout | null,
  reject: (error: Error) => void,
): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
  reject(error)
}

function stopMcpInspector() {
  if (inspectorProcess) {
    inspectorProcess.kill()
    resetState()
  }
}

export function addDevToolsCustomTabs(nuxt: Nuxt, options: ModuleOptions) {
  nuxt.hook('devtools:customTabs', (tabs) => {
    if (!options.enabled) {
      return
    }

    tabs.push({
      category: 'server',
      name: 'mcp-inspector',
      title: 'MCP Inspector',
      icon: 'i-lucide-circuit-board',
      view: isReady && inspectorUrl
        ? {
            type: 'iframe',
            src: inspectorUrl,
          }
        : {
            type: 'launch',
            description: 'Launch MCP Inspector to test/debug your MCP server',
            actions: [
              {
                label: promise ? 'Starting...' : 'Launch Inspector',
                pending: !!promise,
                handle() {
                  promise = promise || launchMcpInspector(nuxt, options).finally(() => {
                    promise = null
                  })
                  return promise
                },
              },
              ...(inspectorProcess
                ? [{
                    label: 'Stop Inspector',
                    handle() {
                      stopMcpInspector()
                      promise = null
                    },
                  }]
                : []),
            ],
          },
    })
  })

  nuxt.hook('close', () => {
    stopMcpInspector()
  })
}
