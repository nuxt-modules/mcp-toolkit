import { defineMcpResource } from 'nitro-mcp-toolkit'

export default defineMcpResource({
  uri: 'docs://readme',
  handler: () => 'Fixture readme',
})
