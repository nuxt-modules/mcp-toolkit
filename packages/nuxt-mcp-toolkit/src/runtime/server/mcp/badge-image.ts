import { defineEventHandler, getQuery, setHeader } from 'h3'
import satori from 'satori'

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

// Cursor icon for Satori
function CursorIcon() {
  return {
    type: 'svg',
    props: {
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      style: { filter: 'invert(1)' },
      children: [
        {
          type: 'path',
          props: {
            fill: '#666',
            d: 'M11.925 24l10.425-6-10.425-6L1.5 18l10.425 6z',
          },
        },
        {
          type: 'path',
          props: {
            fill: '#888',
            d: 'M22.35 18V6L11.925 0v12l10.425 6z',
          },
        },
        {
          type: 'path',
          props: {
            fill: '#777',
            d: 'M11.925 0L1.5 6v12l10.425-6V0z',
          },
        },
        {
          type: 'path',
          props: {
            fill: '#555',
            d: 'M22.35 6L11.925 24V12L22.35 6z',
          },
        },
        {
          type: 'path',
          props: {
            fill: '#333',
            d: 'M22.35 6l-10.425 6L1.5 6h20.85z',
          },
        },
      ],
    },
  }
}

// VS Code icon
function VSCodeIconSimple() {
  return {
    type: 'svg',
    props: {
      width: 18,
      height: 18,
      viewBox: '0 0 24 24',
      children: [
        {
          type: 'path',
          props: {
            fill: '#007ACC',
            d: 'M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63l-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12L.326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128l9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z',
          },
        },
      ],
    },
  }
}

function getIcon(ide: SupportedIDE) {
  return ide === 'vscode' ? VSCodeIconSimple() : CursorIcon()
}

async function generateBadgeSVG(options: BadgeOptions): Promise<string> {
  const { label, color, textColor, borderColor, showIcon, ide } = options

  const icon = getIcon(ide)

  const element = {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        fontSize: '14px',
        fontWeight: 500,
        color: `#${textColor}`,
        backgroundColor: `#${color}`,
        border: `1px solid #${borderColor}`,
      },
      children: showIcon
        ? [icon, { type: 'span', props: { children: label } }]
        : [{ type: 'span', props: { children: label } }],
    },
  }

  // Calculate width based on content - increased multiplier for better fit
  const iconWidth = showIcon ? 26 : 0 // 18px icon + 8px gap
  const textWidth = label.length * 8 // Character width
  const padding = 20 // 8px * 2 + buffer
  const width = Math.max(Math.ceil(iconWidth + textWidth + padding), 140)
  const height = 32

  const svg = await satori(element, {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: await loadFont(),
        weight: 500,
        style: 'normal',
      },
    ],
  })

  return svg
}

// Load a basic font (Inter from Google Fonts)
async function loadFont(): Promise<ArrayBuffer> {
  const response = await fetch(
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff',
  )

  if (!response.ok) {
    throw new Error(`Failed to load font: ${response.status} ${response.statusText}`)
  }

  return response.arrayBuffer()
}

export default defineEventHandler(async (event) => {
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

  try {
    const svg = await generateBadgeSVG(options)

    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400')

    return svg
  }
  catch {
    // Return a simple fallback SVG if font loading fails
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'no-cache')

    return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="32">
      <rect width="140" height="32" fill="#171717" stroke="#404040"/>
      <text x="70" y="20" fill="#fff" font-size="12" text-anchor="middle">${options.label}</text>
    </svg>`
  }
})
