import { defineEventHandler } from 'nuxt/server'
import { mcp } from 'nitro-mcp-toolkit/servers'

export default defineEventHandler(() => {
  mcp.notify.toolsChanged()
  return { ok: true }
})
