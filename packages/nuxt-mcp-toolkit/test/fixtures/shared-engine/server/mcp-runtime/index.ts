import { createMcpOAuth, defineMcpServer } from '@nuxtjs/mcp-toolkit/server'
import { useRuntimeConfig } from 'nuxt/server'

export default defineMcpServer({
  oauth: createMcpOAuth({
    resource: 'https://nuxt.example.com/runtime/mcp',
    authorizationServers: ['https://auth.example.com'],
    scopesSupported: ['read'],
    verify(token, event) {
      const memberToken = useRuntimeConfig().mcpRuntimeToken
      if (token !== memberToken && token !== 'outsider-token') return false
      event.context.oauth = { sub: token === memberToken ? 'member' : 'outsider', scope: 'read' }
      return true
    },
  }),
  authorize: (claims, event) => claims.sub === 'member'
    && claims.scope === 'read'
    && event.context.user === 'demo-user',
})
