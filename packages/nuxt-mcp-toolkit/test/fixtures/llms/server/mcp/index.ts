import { defineMcpServer } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpServer({
  name: 'Fixture MCP',
  description: 'Fixture MCP server used in tests.',
  websiteUrl: 'https://docs.fixture.test/mcp',
})
