import { z } from 'zod'

export default defineMcpTool({
  name: 'create_todo',
  description: 'Create a new todo for the authenticated user',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  inputExamples: [
    { title: 'Buy groceries', content: 'Milk, eggs, bread' },
    { title: 'Fix login bug' },
  ],
  inputSchema: {
    title: z.string().describe('The title of the todo'),
    content: z.string().optional().describe('Optional description or content for the todo'),
  },
  handler: async ({ title, content }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const [todo] = await db.insert(schema.todos).values({
      title,
      content: content || null,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning()

    return textResult(`Todo created successfully!\n\nTitle: ${todo.title}${todo.content ? `\nContent: ${todo.content}` : ''}`)
  },
})
