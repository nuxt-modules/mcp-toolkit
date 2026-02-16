import { z } from 'zod'
import { eq, and } from 'drizzle-orm'

export default defineMcpTool({
  name: 'delete_todo',
  description: 'Delete a todo',
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    id: z.number().describe('The ID of the todo to delete'),
  },
  handler: async ({ id }) => {
    const event = useEvent()
    const userId = event.context.userId as string

    const existingTodo = await db.query.todos.findFirst({
      where: (todos, { eq: e, and: a }) => a(e(todos.id, id), e(todos.userId, userId)),
    })

    if (!existingTodo) {
      return textResult(`Todo with ID ${id} not found or you don't have permission to delete it.`)
    }

    await db.delete(schema.todos)
      .where(and(eq(schema.todos.id, id), eq(schema.todos.userId, userId)))

    return textResult(`Todo "${existingTodo.title}" has been deleted.`)
  },
})
