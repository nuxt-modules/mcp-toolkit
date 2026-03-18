interface Note {
  text: string
  createdAt: string
}

interface NotesSession {
  notes: Note[]
}

export default defineMcpTool({
  name: 'get_notes',
  title: 'Get Notes',
  description: 'Retrieve all notes stored in the current session notepad.',
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
  },
  handler: async () => {
    const session = useMcpSession<NotesSession>()
    const notes = await session.get('notes') ?? []

    if (notes.length === 0) {
      return textResult('No notes in this session yet. Use the add_note tool to create one.')
    }

    return jsonResult(notes)
  },
})
