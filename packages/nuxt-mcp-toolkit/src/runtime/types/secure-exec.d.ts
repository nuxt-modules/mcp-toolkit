/**
 * Minimal type surface for the optional `secure-exec` peer dependency
 * used by Code Mode. Only the parts the toolkit actually touches are
 * declared — enough to type the executor without bundling the full
 * upstream `.d.ts`.
 *
 * Kept as a script (no top-level imports/exports) so the ambient
 * `declare module` block is picked up globally without an explicit
 * reference.
 */

declare module 'secure-exec' {
  export interface ExecResult {
    /** Process-style exit code. `0` on success. */
    code: number
    /** Populated when the runtime aborted (e.g. memory/CPU limit hit). */
    errorMessage?: string
  }

  export interface ExecStdioEvent {
    channel: 'stdout' | 'stderr' | string
    message: string
  }

  export interface ExecOptions {
    /** Receives every line written to stdout/stderr by the sandboxed program. */
    onStdio?: (event: ExecStdioEvent) => void
  }

  export interface NodeRuntimeOptions {
    systemDriver: unknown
    runtimeDriverFactory: unknown
    /** Memory cap for the sandboxed process, in MB. */
    memoryLimit?: number
    /** Wall-clock CPU budget for the sandboxed process, in ms. */
    cpuTimeLimitMs?: number
  }

  export class NodeRuntime {
    constructor(options: NodeRuntimeOptions)
    exec(code: string, options?: ExecOptions): Promise<ExecResult>
    dispose(): void
  }

  export interface NetworkAdapterFetchOptions {
    method?: string
    headers?: Record<string, string>
    body?: string | null
  }

  export interface NetworkAdapterFetchResult {
    ok: boolean
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    url: string
    redirected: boolean
  }

  export interface NetworkAdapter {
    fetch(url: string, options: NetworkAdapterFetchOptions): Promise<NetworkAdapterFetchResult>
    dnsLookup(...args: unknown[]): Promise<{ error: string, code: string }>
    httpRequest(...args: unknown[]): Promise<unknown>
  }

  export interface PermissionsConfig {
    network?: () => { allow: boolean }
  }

  export interface NodeDriverOptions {
    networkAdapter?: NetworkAdapter
    permissions?: PermissionsConfig
  }

  export function createNodeDriver(options?: NodeDriverOptions): unknown
  export function createNodeRuntimeDriverFactory(): unknown
}
