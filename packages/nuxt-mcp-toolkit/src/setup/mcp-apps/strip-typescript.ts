import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const MCP_APP_ARG_PREFIX = 'const __mcpAppArg = '

function tryLoadEsbuild(): typeof import('esbuild') | null {
  try {
    return require('esbuild') as typeof import('esbuild')
  }
  catch {
    return null
  }
}

function extractAssignedExpression(code: string): string {
  const trimmed = code.trim().replace(/;\s*$/, '')
  if (trimmed.startsWith(MCP_APP_ARG_PREFIX)) {
    return trimmed.slice(MCP_APP_ARG_PREFIX.length)
  }
  return trimmed
}

/**
 * Remove TypeScript-only syntax from a `defineMcpApp({ ... })` argument object
 * before it is embedded in `.mjs` Nitro virtual modules (Rollup parses those as JS).
 */
export function stripTypeScriptFromMacroArg(argText: string): string {
  const esbuild = tryLoadEsbuild()
  if (esbuild) {
    try {
      const result = esbuild.transformSync(`${MCP_APP_ARG_PREFIX}${argText}`, {
        loader: 'ts',
        target: 'esnext',
      })
      return extractAssignedExpression(result.code)
    }
    catch {
      // Fall through to the heuristic stripper below.
    }
  }

  return stripTypeScriptFromMacroArgHeuristic(argText)
}

/** Regex/balanced-bracket fallback when esbuild is unavailable. */
function stripTypeScriptFromMacroArgHeuristic(argText: string): string {
  let out = stripCallTypeArguments(argText)
  out = out.replace(/\):[^=\n]*=>/g, ') =>')
  return out
}

/**
 * Strip generic call-site type arguments, e.g.
 * `$fetch<T>(url)` → `$fetch(url)`.
 *
 * Uses the `>`-then-`(` heuristic to avoid eating comparison operators (`a < b`).
 */
function stripCallTypeArguments(source: string): string {
  let out = ''
  let i = 0

  while (i < source.length) {
    if (source[i] === '<' && isGenericTypeArgumentStart(source, i)) {
      const end = skipBalancedGenerics(source, i)
      if (end !== -1 && isGenericTypeArgumentEnd(source, end)) {
        i = end + 1
        continue
      }
    }
    out += source[i]
    i++
  }

  return out
}

function isGenericTypeArgumentStart(source: string, index: number): boolean {
  let j = index - 1
  while (j >= 0 && /\s/.test(source[j]!)) j--
  if (j < 0) return false
  return /[\w)\]>]$/.test(source[j]!)
}

function isGenericTypeArgumentEnd(source: string, closeIndex: number): boolean {
  let j = closeIndex + 1
  while (j < source.length && /\s/.test(source[j]!)) j++
  const next = source[j]
  return next === '(' || next === '.' || next === '<' || next === '['
}

function skipBalancedGenerics(source: string, openIndex: number): number {
  let depth = 0
  let str: string | null = null

  for (let i = openIndex; i < source.length; i++) {
    const c = source[i]
    const next = source[i + 1]

    if (str) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === str) str = null
      continue
    }

    if (c === '/' && next === '/') {
      const eol = source.indexOf('\n', i)
      i = eol === -1 ? source.length - 1 : eol
      continue
    }
    if (c === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2)
      i = close === -1 ? source.length - 1 : close + 1
      continue
    }
    if (c === '"' || c === '\'' || c === '`') {
      str = c
      continue
    }

    if (c === '<') depth++
    else if (c === '>') {
      depth--
      if (depth === 0) return i
    }
  }

  return -1
}
