import { z } from 'zod'

export default defineMcpTool({
  name: 'add_note',
  description: 'Store a note for the authenticated user across MCP connections.',
  inputSchema: z.object({ note: z.string() }),
  handler: async ({ note }, event) => {
    const userId = event.context.userId
    if (typeof userId !== 'string') throw new Error('Authentication required.')
    const key = `notes:${encodeURIComponent(userId)}`
    const storage = useStorage()
    const notes = await storage.getItem<string[]>(key) ?? []
    await storage.setItem(key, [...notes, note])
    return `Note added (${notes.length + 1} total).`
  },
})
