import { kebabCase, titleCase } from 'scule'

export interface EnrichNameTitleOptions {
  name?: string
  title?: string
  _meta?: Record<string, unknown>
  type: 'tool' | 'resource' | 'prompt' | 'app'
}

export interface EnrichNameTitleResult {
  name: string
  title?: string
}

/**
 * Enrich name and title from filename if missing
 */
export function enrichNameTitle(options: EnrichNameTitleOptions): EnrichNameTitleResult {
  const { name, title, _meta, type } = options
  const filename = _meta?.filename as string | undefined

  let enrichedName = name
  let enrichedTitle = title

  if (filename) {
    const nameWithoutExt = filename.replace(/\.(ts|js|mts|mjs)$/, '')
    if (!enrichedName) {
      enrichedName = kebabCase(nameWithoutExt)
    }
    if (!enrichedTitle) {
      enrichedTitle = titleCase(nameWithoutExt)
    }
  }

  if (!enrichedName) {
    throw new Error(`Failed to auto-generate ${type} name from filename. Please provide a name explicitly.`)
  }

  return {
    name: enrichedName,
    title: enrichedTitle,
  }
}
