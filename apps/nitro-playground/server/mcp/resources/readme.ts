import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  name: 'readme',
  uri: 'playground://readme',
  description: 'What this playground is for',
  mimeType: 'text/markdown',
  handler: () =>
    [
      '# Nitro MCP playground',
      '',
      'Every definition here exercises one feature of the toolkit.',
      'Browse them in the inspector at http://localhost:3030.',
    ].join('\n'),
})
