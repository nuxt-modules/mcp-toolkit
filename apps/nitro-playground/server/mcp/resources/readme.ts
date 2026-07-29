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
      'Run `pnpm probe:nitro` from the monorepo root to list them.',
    ].join('\n'),
})
