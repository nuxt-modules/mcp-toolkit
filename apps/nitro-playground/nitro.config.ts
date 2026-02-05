import { defineMcpNitroModule } from 'nitro-mcp-toolkit'

export default defineNitroConfig({
  compatibilityDate: '2026-01-01',

  modules: [
    defineMcpNitroModule({
      route: '/mcp',
      name: 'nitro-mcp-playground',
      version: '1.0.0',
    }),
  ],

  experimental: {
    asyncContext: true,
  },
})
