import { defineMcpAuth } from 'nitro-mcp-toolkit'

export default defineMcpAuth({
  schemes: ['bearer'],
  validate: ({ token }) => token === 'runtime-token',
})
