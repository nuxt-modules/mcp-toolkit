import { existsSync } from 'node:fs'
import { watch } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DEFINITION_DIRS } from './discover.ts'
import type { Nitro } from 'nitro/types'

const DEFINITION_FILE_RE = /\.(?:ts|js|mts|mjs)$/

/** The deepest ancestor that exists, so a directory created later is still seen. */
function watchableRoot(dir: string): string {
  let candidate = dir

  while (!existsSync(candidate)) {
    const parent = dirname(candidate)

    if (parent === candidate) return candidate

    candidate = parent
  }

  return candidate
}

function isDefinitionFile(dir: string, path: string): boolean {
  if (!DEFINITION_FILE_RE.test(path)) return false

  return DEFINITION_DIRS.some((definitionDir) => path.startsWith(join(dir, definitionDir)))
}

/**
 * Rebuild when a definition file appears or disappears.
 *
 * Edits to a file already in the registry reach the bundler through its import,
 * but a new file is imported by nothing yet — the registry has to be generated
 * again before anything can see it.
 */
export function watchDefinitions(nitro: Nitro, dir: string): void {
  const root = watchableRoot(dir)
  const controller = new AbortController()

  nitro.hooks.hook('close', () => controller.abort())

  void (async () => {
    try {
      const events = watch(root, { recursive: true, signal: controller.signal })

      for await (const { eventType, filename } of events) {
        // `rename` is what an added or removed file reports; `change` is an edit.
        if (eventType !== 'rename' || !filename) continue

        if (isDefinitionFile(dir, resolve(root, filename))) {
          await nitro.hooks.callHook('rollup:reload')
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return

      nitro.logger.warn(
        `[mcp] Stopped watching ${dir} for new definitions; restart to pick them up.`,
        error,
      )
    }
  })()
}
