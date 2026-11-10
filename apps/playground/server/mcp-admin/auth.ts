import { defineMcpAuth } from '@nuxtjs/mcp-toolkit/server'
import { useRuntimeConfig } from 'nuxt/server'

export default defineMcpAuth({
  schemes: ['bearer'],
  validate: ({ token }) => token === useRuntimeConfig().mcpAdminToken,
})
