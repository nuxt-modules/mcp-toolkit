export function normalizeCode(userCode: string): string {
  let code = userCode.trim()

  // Strip markdown fences
  code = code
    .replace(/^```(?:js|javascript|typescript|ts|tsx|jsx)?[ \t]*\n/, '')
    .replace(/\n?```[ \t]*$/, '')
    .trim()

  // Strip `export default` prefix
  code = code.replace(/^export\s+default\s+/, '')

  // Unwrap arrow function: `async () => { ... }`
  const arrowMatch = code.match(/^async\s*\(\s*\)\s*=>\s*\{([\s\S]*)\}[;\t ]*$/)
  if (arrowMatch?.[1]) {
    code = arrowMatch[1].trim()
  }
  else {
    // Unwrap arrow expression: `async () => expr`
    // Use indexOf to avoid regex backtracking between \s* and [\s\S]+
    const arrowIdx = code.search(/^async\s*\(\s*\)\s*=>/)
    if (arrowIdx === 0) {
      const arrowEnd = code.indexOf('=>')
      if (arrowEnd !== -1) {
        const expr = code.slice(arrowEnd + 2).trim()
        if (expr && !expr.startsWith('{')) {
          code = `return ${expr.replace(/;[ \t]*$/, '')};`
        }
      }
    }
  }

  // Unwrap IIFE: `(async () => { ... })()`
  const iifeMatch = code.match(/^\(\s*async\s*\(\s*\)\s*=>\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)[;\t ]*$/)
  if (iifeMatch?.[1]) {
    code = iifeMatch[1].trim()
  }

  // Unwrap `async function main() { ... }; main()` pattern
  const namedFnMatch = code.match(/^async\s+function\s+(\w+)\s*\(\s*\)\s*\{([\s\S]*)\}[;\s]*\1\s*\(\s*\)[;\s]*$/)
  if (namedFnMatch?.[2]) {
    code = namedFnMatch[2].trim()
  }

  return code
}
