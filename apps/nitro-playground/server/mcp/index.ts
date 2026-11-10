import { defineMcpServer } from 'nitro-mcp-toolkit'

export default defineMcpServer({
  name: 'nitro-mcp-playground',
  version: '0.0.0',
  title: 'Nitro MCP Playground',
  description: 'Every definition here exercises one feature of nitro-mcp-toolkit.',
  icons: [{ src: 'https://nitro.build/icon.svg', mimeType: 'image/svg+xml' }],
  websiteUrl: 'https://github.com/nuxt-modules/mcp-toolkit',
  instructions: 'Call `whoami` first; it reports everything the server sees.',
})
