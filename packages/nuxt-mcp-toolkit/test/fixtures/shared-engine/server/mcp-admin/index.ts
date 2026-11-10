import { defineMcpServer } from '@nuxtjs/mcp-toolkit/server'
import { useRuntimeConfig } from 'nuxt/server'

export default defineMcpServer({
  name: 'indexed-nuxt-admin',
  instructions: 'Nuxt index instructions',
  auth: {
    schemes: ['bearer'],
    validate: ({ token }) => token === useRuntimeConfig().mcpAdminToken,
  },
})
