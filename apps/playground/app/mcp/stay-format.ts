export const formatDate = (iso?: string): string => {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso + 'T00:00:00Z'))
}

export const formatRange = (a?: string, b?: string): string =>
  a && b ? `${formatDate(a)} – ${formatDate(b)}` : ''

export const initials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join('')

export const starSlots = (n: number): boolean[] =>
  Array.from({ length: 4 }, (_, i) => i < n)
