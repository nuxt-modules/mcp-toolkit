import { defineConfig } from 'nitro'
import { nitroMcpToolkit } from 'nitro-mcp-toolkit'

export default defineConfig({
  compatibilityDate: '2026-07-01',
  modules: [nitroMcpToolkit()],
})
