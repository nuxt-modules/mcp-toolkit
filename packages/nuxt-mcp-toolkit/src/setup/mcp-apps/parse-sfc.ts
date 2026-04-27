import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'

const MACRO_NAME = 'defineMcpApp'

const VUE_AUTO_IMPORTS = ['ref', 'shallowRef', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted', 'onBeforeUnmount', 'onUnmounted', 'nextTick']
const TOOLKIT_AUTO_IMPORTS: Array<{ name: string, from: string }> = [
  { name: 'useMcpApp', from: '@nuxtjs/mcp-toolkit/app' },
]

export interface ParsedSfcApp {
  /** Extracted `defineMcpApp({...})` argument text, or `{}` when the macro is absent. */
  argText: string
  /** Imports from `<script setup>` referenced inside `argText`. */
  imports: string[]
  /** SFC source with the macro call replaced by `void 0` for the browser bundle. */
  bundleSource: string
}

interface MacroCall {
  argText: string
  start: number
  end: number
}

interface ImportInfo {
  names: string[]
  text: string
}

/** Balanced-paren scanner: locates the first `<macro>(...)` and returns its arg text. */
export function findMacroCall(source: string, macroName: string): MacroCall | null {
  const re = new RegExp(`\\b${macroName}\\s*\\(`, 'g')
  const match = re.exec(source)
  if (!match) return null

  const argStart = match.index + match[0].length
  let depth = 1
  let i = argStart
  let str: string | null = null

  while (i < source.length && depth > 0) {
    const c = source[i]
    const next = source[i + 1]

    if (str) {
      if (c === '\\') {
        i += 2
        continue
      }
      if (c === str) str = null
      i++
      continue
    }

    if (c === '/' && next === '/') {
      const eol = source.indexOf('\n', i)
      i = eol === -1 ? source.length : eol + 1
      continue
    }
    if (c === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2)
      i = close === -1 ? source.length : close + 2
      continue
    }
    if (c === '"' || c === '\'' || c === '`') {
      str = c
      i++
      continue
    }
    if (c === '(') depth++
    else if (c === ')') depth--
    i++
  }

  if (depth !== 0) return null

  const argEnd = i - 1
  let end = i
  while (end < source.length && /[\s;]/.test(source[end]!)) end++

  return {
    argText: source.slice(argStart, argEnd).trim() || '{}',
    start: match.index,
    end,
  }
}

/** Pull every standard ESM `import ... from '...'` out of a script body. */
export function collectImports(script: string): ImportInfo[] {
  const out: ImportInfo[] = []
  // eslint-disable-next-line regexp/no-super-linear-backtracking -- build-time scan over our own SFC source
  const re = /^[ \t]*import\s+([\s\S]+?\S)\s+from\s+(['"])([^'"]+)\2\s*;?/gm
  for (const m of script.matchAll(re)) {
    const clause = m[1]!.trim()
    const text = m[0]!.trimEnd()
    const names: string[] = []

    const def = /^([a-z_$][\w$]*)\s*(?:,|$)/i.exec(clause)
    if (def) names.push(def[1]!)

    const ns = /\*\s*as\s+([a-z_$][\w$]*)/i.exec(clause)
    if (ns) names.push(ns[1]!)

    const named = /\{([^}]+)\}/.exec(clause)
    if (named) {
      for (const part of named[1]!.split(',')) {
        const tok = part.trim()
        if (!tok) continue
        const local = /(?:\s+as\s+)?([a-z_$][\w$]*)\s*$/i.exec(tok)
        if (local) names.push(local[1]!)
      }
    }

    out.push({ names, text })
  }
  return out
}

/** Filter `imports` to those whose bound names appear in `body`. Side-effect imports are always kept. */
export function pickRelevantImports(imports: ImportInfo[], body: string): string[] {
  return imports
    .filter((imp) => {
      if (imp.names.length === 0) return true
      return imp.names.some(n => new RegExp(`\\b${n}\\b`).test(body))
    })
    .map(imp => imp.text)
}

/** Rewrite `./foo` / `../foo` specifiers to absolute paths anchored at `sfcDir`. */
export function absolutiseRelativeImports(importTexts: string[], sfcDir: string): string[] {
  return importTexts.map(text => absolutiseRelativeImport(text, sfcDir))
}

function absolutiseRelativeImport(text: string, sfcDir: string): string {
  return text.replace(/(from\s+)(['"])(\.{1,2}\/[^'"]+)\2/, (_, prefix, quote, spec) => {
    return `${prefix}${quote}${resolvePath(sfcDir, spec)}${quote}`
  })
}

/** Rewrite every relative `import ... from './x'` in a script body to absolute paths. */
function absolutiseAllRelativeImports(script: string, sfcDir: string): string {
  return script.replace(
    // eslint-disable-next-line regexp/no-super-linear-backtracking -- build-time scan over our own SFC source
    /^([ \t]*import\s+[\s\S]+?\s+from\s+)(['"])(\.{1,2}\/[^'"]+)\2/gm,
    (_, prefix, quote, spec) => `${prefix}${quote}${resolvePath(sfcDir, spec)}${quote}`,
  )
}

/** Build the auto-import preamble, skipping any name the user already imported. */
function buildAutoImportsBlock(existingNames: Set<string>): string {
  const lines: string[] = []
  const vueMissing = VUE_AUTO_IMPORTS.filter(n => !existingNames.has(n))
  if (vueMissing.length) lines.push(`import { ${vueMissing.join(', ')} } from 'vue'`)
  for (const { name, from } of TOOLKIT_AUTO_IMPORTS) {
    if (!existingNames.has(name)) lines.push(`import { ${name} } from '${from}'`)
  }
  return lines.length ? `${lines.join('\n')}\n` : ''
}

function injectBundleAutoImports(source: string, scriptOffset: number | null, existingNames: Set<string>): string {
  if (scriptOffset === null) return source
  const block = buildAutoImportsBlock(existingNames)
  if (!block) return source
  return `${source.slice(0, scriptOffset)}\n${block}${source.slice(scriptOffset)}`
}

/** Parse a Vue SFC; extract macro args and emit a bundle source with the macro neutralised. */
export async function parseSfcApp(sfcPath: string): Promise<ParsedSfcApp> {
  const { parse } = await import('@vue/compiler-sfc')
  const source = await readFile(sfcPath, 'utf-8')
  const { descriptor } = parse(source, { filename: sfcPath })

  const sfcDir = dirname(sfcPath)
  const scriptBlock = descriptor.scriptSetup ?? descriptor.script
  if (!scriptBlock) {
    const bundleSource = absolutiseAllRelativeImports(injectBundleAutoImports(source, null, new Set()), sfcDir)
    return { argText: '{}', imports: [], bundleSource }
  }

  const scriptContent = scriptBlock.content
  const macro = findMacroCall(scriptContent, MACRO_NAME)
  const scriptOffset = scriptBlock.loc.start.offset
  const allImports = collectImports(scriptContent)
  const existingNames = new Set(allImports.flatMap(i => i.names))
  const sourceWithImports = injectBundleAutoImports(source, scriptOffset, existingNames)

  if (!macro) {
    return { argText: '{}', imports: [], bundleSource: absolutiseAllRelativeImports(sourceWithImports, sfcDir) }
  }
  if (findMacroCall(scriptContent.slice(macro.end), MACRO_NAME)) {
    throw new Error(`Multiple ${MACRO_NAME}() calls found in ${sfcPath}. MCP App SFCs support exactly one app definition.`)
  }

  const imports = absolutiseRelativeImports(
    pickRelevantImports(allImports, macro.argText),
    dirname(sfcPath),
  )

  const offsetShift = sourceWithImports.length - source.length
  const macroStart = scriptOffset + macro.start + offsetShift
  const macroEnd = scriptOffset + macro.end + offsetShift
  const bundleSource = absolutiseAllRelativeImports(
    `${sourceWithImports.slice(0, macroStart)}void 0;${sourceWithImports.slice(macroEnd)}`,
    sfcDir,
  )

  return { argText: macro.argText, imports, bundleSource }
}
