import { defineEventHandler, getQuery, setHeader } from 'h3'

export type SupportedIDE = 'cursor' | 'vscode'

interface BadgeOptions {
  label: string
  color: string
  textColor: string
  borderColor: string
  showIcon: boolean
  ide: SupportedIDE
}

const IDE_CONFIG = {
  cursor: {
    defaultLabel: 'Install MCP in Cursor',
  },
  vscode: {
    defaultLabel: 'Install MCP in VS Code',
  },
}

function cursorIconSvg(): string {
  return `<g transform="translate(8,7) scale(0.75)">
    <path fill="#999" d="M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z"/>
    <path fill="#bbb" d="M22.35 18V6L11.925 0v12l10.425 6z"/>
    <path fill="#aaa" d="M11.925 0L1.5 6v12l10.425-6V0z"/>
    <path fill="#888" d="M22.35 6L11.925 24V12L22.35 6z"/>
    <path fill="#fff" d="M22.35 6l-10.425 6L1.5 6h20.85z"/>
  </g>`
}

function vscodeIconSvg(): string {
  return `<g transform="translate(8,7) scale(0.75)">
    <path fill="#007ACC" d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63l-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12L.326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128l9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
  </g>`
}

function estimateTextWidth(text: string, fontSize: number): number {
  const ratio = fontSize / 13
  let width = 0
  for (const ch of text) {
    if (ch === ' ') width += 3.6
    else if ('iIl|1!:;.,'.includes(ch)) width += 4.2
    else if ('fjrt()[]{}\'"/'.includes(ch)) width += 5.2
    else if ('mwMW'.includes(ch)) width += 10
    else if (ch >= 'A' && ch <= 'Z') width += 8.5
    else width += 7
  }
  return width * ratio
}

function generateBadgeSVG(options: BadgeOptions): string {
  const { label, color, textColor, borderColor, showIcon, ide } = options

  const iconWidth = showIcon ? 26 : 0
  const textWidth = estimateTextWidth(label, 13)
  const padding = showIcon ? 24 : 22
  const width = Math.ceil(iconWidth + textWidth + padding)
  const height = 32

  const textX = showIcon ? 34 : width / 2
  const textAnchor = showIcon ? 'start' : 'middle'

  const icon = showIcon
    ? (ide === 'vscode' ? vscodeIconSvg() : cursorIconSvg())
    : ''

  const escapedLabel = label
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="4" fill="#${color}" stroke="#${borderColor}"/>
  ${icon}
  <text x="${textX}" y="21" fill="#${textColor}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="500" text-anchor="${textAnchor}">${escapedLabel}</text>
</svg>`
}

export default defineEventHandler((event) => {
  const query = getQuery(event)

  const ide = (query.ide as SupportedIDE) || 'cursor'
  const ideConfig = IDE_CONFIG[ide] || IDE_CONFIG.cursor

  const options: BadgeOptions = {
    ide,
    label: (query.label as string) || ideConfig.defaultLabel,
    color: (query.color as string) || '171717',
    textColor: (query.textColor as string) || 'ffffff',
    borderColor: (query.borderColor as string) || '404040',
    showIcon: query.icon !== 'false',
  }

  const svg = generateBadgeSVG(options)

  setHeader(event, 'Content-Type', 'image/svg+xml')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')

  return svg
})
