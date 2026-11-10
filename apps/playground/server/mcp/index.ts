import { defineMcpServer } from '@nuxtjs/mcp-toolkit/server'

export default defineMcpServer({
  name: 'Playground MCP',
  description: 'A demo MCP server showcasing authentication, todos, and user management.',
  instructions: 'Authenticate with an API key before calling protected tools. Use list-todos before create-todo to avoid duplicates.',
})
