import { defineMcpServer } from '@nuxtjs/mcp-toolkit/server'
import { useRuntimeConfig } from 'nuxt/server'

export default defineMcpServer({
  auth: {
    schemes: ['bearer'],
    validate: ({ token }) => token === useRuntimeConfig().mcpAdminToken,
  },
})
