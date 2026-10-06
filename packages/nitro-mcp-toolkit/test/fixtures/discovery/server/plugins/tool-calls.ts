import { definePlugin } from 'nitro'
import { toolCalls } from '../utils/tool-calls.ts'

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook('mcp:tool:called', ({ name, event }) => {
    toolCalls.push({ name, path: event.url.pathname })
  })
})
