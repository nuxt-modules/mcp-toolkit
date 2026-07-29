const EXTENSION_RE = /\.(?:ts|js|mts|mjs)$/

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

/**
 * The name and title a filename implies: `list-documentation.ts` becomes
 * `list-documentation` and `List Documentation`.
 */
export function identityFromFilename(filename: string): { name: string; title: string } {
  const stem = filename.replace(EXTENSION_RE, '')

  return { name: kebabCase(stem), title: titleCase(stem) }
}
