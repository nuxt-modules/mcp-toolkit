import { z } from 'zod'

interface Note {
  text: string
  createdAt: string
}

interface NotesSession {
  notes: Note[]
}

export default defineMcpTool({
  name: 'add_note',
  title: 'Add Note',
  description: 'Add a note to the current session notepad. Notes persist across tool calls within the same MCP session.',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
  },
  inputSchema: {
    note: z.string().describe('The note content to add'),
  },
  handler: async ({ note }) => {
    const session = useMcpSession<NotesSession>()
    const notes = await session.get('notes') ?? []
    notes.push({ text: note, createdAt: new Date().toISOString() })
    await session.set('notes', notes)

    return textResult(`Note added (${notes.length} total in this session).`)
  },
})
