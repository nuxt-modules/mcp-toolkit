import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

export default defineMcpTool({
  name: 'update_todo',
  description: 'Update an existing todo (title and/or content)',
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputExamples: [
    { id: 1, title: 'Updated title', content: 'New content' },
    { id: 2, title: 'Just rename this' },
  ],
  inputSchema: {
    id: z.number().describe('The ID of the todo to update'),
    title: z.string().optional().describe('New title for the todo'),
    content: z.string().optional().describe('New content/description for the todo'),
  },
  handler: async ({ id, title, content }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const existingTodo = await db.query.todos.findFirst({
      where: (todos, { eq: e, and: a }) => a(e(todos.id, id), e(todos.userId, userId)),
    })

    if (!existingTodo) {
      return textResult(`Todo with ID ${id} not found or you don't have permission to update it.`)
    }

    const updateData: { title?: string, content?: string | null, updatedAt: Date } = {
      updatedAt: new Date(),
    }

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content || null

    const [updated] = await db.update(schema.todos)
      .set(updateData)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))
      .returning()

    return jsonResult(updated)
  },
})
