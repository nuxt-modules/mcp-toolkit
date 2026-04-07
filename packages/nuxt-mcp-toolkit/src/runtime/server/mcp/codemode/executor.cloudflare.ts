import type { CodeModeOptions, ExecuteResult } from './types'
import { normalizeCode } from './normalize-code'

export { normalizeCode }

/**
 * Cloudflare Workers cannot run Code Mode: it depends on `secure-exec` and Node.js
 * (`node:http` RPC bridge). This stub keeps Nitro builds working; enabling
 * `experimental_codeMode` returns a clear runtime error instead of crashing the bundle.
 */
export async function execute(
  _code: string,
  _fns: Record<string, (args: unknown) => Promise<unknown>>,
  _options?: CodeModeOptions,
): Promise<ExecuteResult> {
  return {
    result: undefined,
    error:
      '[nuxt-mcp-toolkit] experimental_codeMode is not supported on Cloudflare Workers '
      + '(requires Node.js: secure-exec, node:http). Use a Node.js deployment target '
      + 'or disable experimental_codeMode.',
    logs: [],
    durationMs: 0,
  }
}

export function dispose(): void {}
