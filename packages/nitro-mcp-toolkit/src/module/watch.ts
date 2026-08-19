import { existsSync } from 'node:fs'
import { watch } from 'node:fs/promises'
// `fs.watch` is the one caller that must be handed the platform's own
// separators: on Windows libuv compares the paths it reports against the one it
// was given and aborts the process when they differ, so a `/` here would take
// the whole dev server down. Everything else stays on `pathe`, since the paths
// we compare against come from a glob.
import { normalize as nativePath } from 'node:path'
import { dirname, extname, join, resolve, sep } from 'pathe'
import { DEFINITION_DIRS, discoverDefinitions } from './discover.ts'
import type { Nitro } from 'nitro/types'

const DEFINITION_FILE_RE = /\.(?:ts|js|mts|mjs)$/

/** Long enough for a `mkdir -p` and the writes that follow it to land together. */
const SETTLE_MS = 50

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

/**
 * Whether a path could change what is served: a definition file in one of the
 * three directories, or a directory on the way to one of them. A directory
 * counts because it can arrive with its files already inside — a moved folder
 * reports only itself, and on Linux a recursive watch attaches to a new
 * subdirectory too late to report what was written into it.
 */
function couldHoldDefinitions(dir: string, path: string): boolean {
  if (extname(path) && !DEFINITION_FILE_RE.test(path)) return false

  return DEFINITION_DIRS.some((definitionDir) => {
    const scanned = join(dir, definitionDir)

    return (
      path === scanned || path.startsWith(`${scanned}${sep}`) || scanned.startsWith(`${path}${sep}`)
    )
  })
}

/** What the registry would import, as one string to compare against. */
async function served(dir: string): Promise<string> {
  const definitions = await discoverDefinitions(dir)

  return definitions.map((definition) => definition.file).join('|')
}

/**
 * Rebuild when a definition file appears or disappears.
 *
 * Edits to a file already in the registry reach the bundler through its import,
 * but a new file is imported by nothing yet — the registry has to be generated
 * again before anything can see it.
 *
 * What an event names is only a hint that something moved: the decision comes
 * from scanning again and comparing, so a missed event costs nothing as long as
 * some later one arrives, and a spurious one costs no rebuild.
 */
export function watchDefinitions(nitro: Nitro, dir: string): void {
  const controller = new AbortController()

  nitro.hooks.hook('close', () => controller.abort())

  // Taken in this turn, before setup returns: a glob after the IIFE yields
  // would already include files created in that gap, and a later scan would
  // look unchanged — the registry generated at setup would stay empty.
  const startedEmpty = !existsSync(dir)

  void (async () => {
    let generated = startedEmpty ? '' : await served(dir)

    const reloadIfChanged = async (): Promise<void> => {
      await new Promise((settle) => setTimeout(settle, SETTLE_MS))

      const current = await served(dir)

      if (current === generated) return

      generated = current

      await nitro.hooks.callHook('rollup:reload')
    }

    try {
      while (!controller.signal.aborted) {
        const root = watchableRoot(dir)
        const inside = root === dir
        // Watching an ancestor recursively would register a watch for every
        // directory under it, node_modules included, to learn one name.
        const events = watch(nativePath(root), { recursive: inside, signal: controller.signal })

        if (inside) await reloadIfChanged()

        for await (const { eventType, filename } of events) {
          // `rename` is what an added or removed file reports; `change` is an edit.
          if (eventType !== 'rename' || !filename) continue

          if (!inside) {
            // Follow the directory down as it appears, a segment at a time.
            if (watchableRoot(dir) !== root) break

            continue
          }

          if (couldHoldDefinitions(dir, resolve(root, filename))) await reloadIfChanged()
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
