export function envValue(names: readonly string[]): string | undefined {
  if (typeof process === 'undefined') return undefined

  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
}
